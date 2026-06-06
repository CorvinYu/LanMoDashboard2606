import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RoutineCheckInStatus, RoutineIntervalUnit } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export type CreateRoutineHabitBody = {
  title: string;
  description?: string;
  category?: string;
  intervalValue: number;
  intervalUnit: RoutineIntervalUnit;
  nextDueAt: string;
  isRolling?: boolean;
  reminderEnabled?: boolean;
  addToToday?: boolean;
};

export type UpdateRoutineHabitBody = Partial<CreateRoutineHabitBody> & {
  isActive?: boolean;
};

export type CheckInRoutineHabitBody = {
  performedAt?: string;
  note?: string;
};

export type CreateSleepLogBody = {
  wentToBedAt: string;
  fellAsleepAt?: string | null;
  wokeUpAt: string;
  quality?: number | null;
  note?: string;
};

type HabitForSchedule = {
  intervalValue: number;
  intervalUnit: RoutineIntervalUnit;
  nextDueAt: Date;
  isRolling: boolean;
};

@Injectable()
export class RoutineService {
  constructor(private readonly prisma: PrismaService) {}

  async listHabits(userId: string) {
    const habits = await this.prisma.routineHabit.findMany({
      where: { userId },
      include: {
        checkIns: {
          orderBy: { performedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ isActive: 'desc' }, { nextDueAt: 'asc' }, { createdAt: 'desc' }],
    });

    return habits.map((habit) => ({
      ...habit,
      state: this.getHabitState(habit.nextDueAt, habit.isActive),
      lastCheckIn: habit.checkIns[0] ?? null,
    }));
  }

  async createHabit(userId: string, body: CreateRoutineHabitBody) {
    const nextDueAt = this.parseDate(body.nextDueAt, '请选择下次到期时间');

    this.validateHabitInput(body);

    return this.prisma.routineHabit.create({
      data: {
        userId,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        category: body.category?.trim() || '生活',
        intervalValue: body.intervalValue,
        intervalUnit: body.intervalUnit,
        nextDueAt,
        isRolling: body.isRolling ?? false,
        reminderEnabled: body.reminderEnabled ?? true,
        addToToday: body.addToToday ?? false,
      },
    });
  }

  async updateHabit(userId: string, id: string, body: UpdateRoutineHabitBody) {
    await this.ensureOwnHabit(id, userId);

    if (body.intervalValue !== undefined || body.intervalUnit !== undefined || body.title !== undefined) {
      this.validateHabitInput({
        title: body.title ?? 'placeholder',
        intervalValue: body.intervalValue ?? 1,
        intervalUnit: body.intervalUnit ?? 'DAYS',
      });
    }

    return this.prisma.routineHabit.update({
      where: { id },
      data: {
        title: body.title?.trim(),
        description: body.description === undefined ? undefined : body.description.trim() || null,
        category: body.category?.trim(),
        intervalValue: body.intervalValue,
        intervalUnit: body.intervalUnit,
        nextDueAt: body.nextDueAt === undefined ? undefined : this.parseDate(body.nextDueAt, '请选择下次到期时间'),
        isRolling: body.isRolling,
        reminderEnabled: body.reminderEnabled,
        addToToday: body.addToToday,
        isActive: body.isActive,
      },
    });
  }

  async removeHabit(userId: string, id: string) {
    await this.ensureOwnHabit(id, userId);

    return this.prisma.routineHabit.delete({
      where: { id },
    });
  }

  async checkInHabit(userId: string, id: string, body: CheckInRoutineHabitBody) {
    return this.recordHabitAction(userId, id, 'COMPLETED', body);
  }

  async skipHabit(userId: string, id: string, body: CheckInRoutineHabitBody) {
    return this.recordHabitAction(userId, id, 'SKIPPED', body);
  }

  async checkOverdueHabits(userId: string) {
    const now = new Date();
    const habits = await this.prisma.routineHabit.findMany({
      where: {
        userId,
        isActive: true,
        reminderEnabled: true,
        nextDueAt: { lt: now },
        OR: [
          { lastRemindedAt: null },
          { lastRemindedAt: { lt: this.getStartOfToday(now) } },
        ],
      },
      orderBy: { nextDueAt: 'asc' },
    });

    for (const habit of habits) {
      await this.prisma.$transaction([
        this.prisma.reminder.create({
          data: {
            userId,
            title: `规律事项待打卡：${habit.title}`,
            remindAt: now,
          },
        }),
        this.prisma.routineHabit.update({
          where: { id: habit.id },
          data: { lastRemindedAt: now },
        }),
      ]);
    }

    return {
      created: habits.length,
      habits,
    };
  }

  async listRecentCheckIns(userId: string) {
    return this.prisma.routineCheckIn.findMany({
      where: { userId },
      include: {
        habit: {
          select: {
            id: true,
            title: true,
            category: true,
          },
        },
      },
      orderBy: { performedAt: 'desc' },
      take: 20,
    });
  }

  async listSleepLogs(userId: string) {
    return this.prisma.sleepLog.findMany({
      where: { userId },
      orderBy: { wokeUpAt: 'desc' },
      take: 30,
    });
  }

  async createSleepLog(userId: string, body: CreateSleepLogBody) {
    const wentToBedAt = this.parseDate(body.wentToBedAt, '请选择上床时间');
    const wokeUpAt = this.parseDate(body.wokeUpAt, '请选择起床时间');

    if (wokeUpAt <= wentToBedAt) {
      throw new BadRequestException('起床时间需要晚于上床时间');
    }

    if (body.quality !== undefined && body.quality !== null && (body.quality < 1 || body.quality > 5)) {
      throw new BadRequestException('睡眠质量需要在 1 到 5 之间');
    }

    return this.prisma.sleepLog.create({
      data: {
        userId,
        wentToBedAt,
        fellAsleepAt: body.fellAsleepAt ? this.parseDate(body.fellAsleepAt, '入睡时间不正确') : null,
        wokeUpAt,
        quality: body.quality ?? null,
        note: body.note?.trim() || null,
      },
    });
  }

  private async recordHabitAction(
    userId: string,
    id: string,
    status: RoutineCheckInStatus,
    body: CheckInRoutineHabitBody,
  ) {
    const habit = await this.ensureOwnHabit(id, userId);
    const performedAt = body.performedAt ? this.parseDate(body.performedAt, '打卡时间不正确') : new Date();
    const nextDueAt = this.scheduleNextDueAt(habit, performedAt);

    return this.prisma.$transaction(async (tx) => {
      const checkIn = await tx.routineCheckIn.create({
        data: {
          userId,
          habitId: id,
          performedAt,
          dueAt: habit.nextDueAt,
          status,
          note: body.note?.trim() || null,
        },
      });
      const updatedHabit = await tx.routineHabit.update({
        where: { id },
        data: {
          nextDueAt,
          lastRemindedAt: null,
        },
      });

      return { habit: updatedHabit, checkIn };
    });
  }

  private validateHabitInput(body: Pick<CreateRoutineHabitBody, 'title' | 'intervalValue' | 'intervalUnit'>) {
    if (!body.title.trim()) {
      throw new BadRequestException('请输入规律事项标题');
    }

    if (!Number.isInteger(body.intervalValue) || body.intervalValue <= 0) {
      throw new BadRequestException('间隔必须是正整数');
    }

    if (!['HOURS', 'DAYS', 'WEEKS', 'MONTHS'].includes(body.intervalUnit)) {
      throw new BadRequestException('间隔单位不正确');
    }
  }

  private scheduleNextDueAt(habit: HabitForSchedule, performedAt: Date) {
    const base = habit.isRolling ? performedAt : habit.nextDueAt;

    return this.addInterval(base, habit.intervalValue, habit.intervalUnit);
  }

  private addInterval(base: Date, value: number, unit: RoutineIntervalUnit) {
    const next = new Date(base);

    if (unit === 'HOURS') {
      next.setHours(next.getHours() + value);
      return next;
    }

    if (unit === 'DAYS') {
      next.setDate(next.getDate() + value);
      return next;
    }

    if (unit === 'WEEKS') {
      next.setDate(next.getDate() + value * 7);
      return next;
    }

    next.setMonth(next.getMonth() + value);
    return next;
  }

  private getHabitState(nextDueAt: Date, isActive: boolean) {
    if (!isActive) {
      return 'inactive';
    }

    const diffMs = nextDueAt.getTime() - Date.now();

    if (diffMs < 0) {
      return 'overdue';
    }

    if (diffMs <= 24 * 60 * 60 * 1000) {
      return 'due-soon';
    }

    return 'ok';
  }

  private parseDate(value: string, message: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(message);
    }

    return date;
  }

  private getStartOfToday(now: Date) {
    const start = new Date(now);

    start.setHours(0, 0, 0, 0);

    return start;
  }

  private async ensureOwnHabit(id: string, userId: string) {
    const habit = await this.prisma.routineHabit.findFirst({
      where: { id, userId },
    });

    if (!habit) {
      throw new NotFoundException('规律事项不存在');
    }

    return habit;
  }
}
