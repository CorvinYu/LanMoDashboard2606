import { Injectable, NotFoundException } from '@nestjs/common';
import { ReminderStatus, TaskStatus } from '@prisma/client';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { PrismaService } from '../prisma.service';
import { RoutineService } from '../routine/routine.service';

const DAY_MS = 86_400_000;
const NUDGE_MS = 3_600_000;
const MAX_STEPS = 10_000;
const SNAPSHOT_LIMIT = 20;

export type ScheduleResetPlan = {
  now: string;
  shiftDays: { tasks: number; events: number };
  tasks: Array<{ id: string; title: string; from: string; to: string }>;
  events: Array<{
    id: string;
    title: string;
    from: string;
    to: string;
    endsFrom: string;
    endsTo: string;
  }>;
  habits: Array<{ id: string; title: string; from: string; to: string; steps: number }>;
  reminders: Array<{ id: string; title: string; from: string; to: string }>;
  counts: {
    tasks: number;
    events: number;
    habits: number;
    reminders: number;
    total: number;
  };
  skipped: {
    inactiveDependentHabits: number;
    tasksWithoutDueAt: number;
    remindersNotPending: number;
  };
};

type SnapshotPayload = {
  version: 1;
  createdAt: string;
  userId: string;
  plan: ScheduleResetPlan;
};

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routine: RoutineService,
  ) {}

  private get snapshotDir() {
    return (
      process.env.SCHEDULE_SNAPSHOT_DIR ??
      path.resolve(process.cwd(), '..', '..', 'backups', 'schedule-resets')
    );
  }

  /** 只预览，不写库 */
  async previewScheduleReset(userId: string) {
    const now = new Date();
    const plan = await this.buildPlan(userId, now);

    return { dryRun: true, applied: false, plan, snapshotFile: null };
  }

  /**
   * 一键把逾期内容恢复到"今天之后继续正常进行"：
   * - 任务 / 倒计时：整体平移（保留原有先后间隔），状态一律不动
   * - 例行事项：复用 RoutineService 的间隔算法，按原周期推进到今天之后
   * - 待办提醒：随所属任务/倒计时平移
   * 执行前先落快照，可用 undo 精确还原。
   */
  async resetSchedule(userId: string, dryRun: boolean) {
    const now = new Date();
    const plan = await this.buildPlan(userId, now);

    if (dryRun) {
      return { dryRun: true, applied: false, plan, snapshotFile: null };
    }

    if (plan.counts.total === 0) {
      return { dryRun: false, applied: false, plan, snapshotFile: null };
    }

    const snapshotFile = await this.writeSnapshot(userId, plan);
    await this.applyPlan(plan);

    return { dryRun: false, applied: true, plan, snapshotFile };
  }

  async listSnapshots() {
    const files = await this.readSnapshotFiles();

    return files.slice(0, SNAPSHOT_LIMIT).map((item) => ({
      file: path.basename(item.file),
      createdAt: item.createdAt,
      counts: item.plan.counts,
    }));
  }

  /** 撤销一次重置；默认撤销最新快照 */
  async undoLastReset(userId: string, snapshotFile?: string) {
    const snapshot = await this.readSnapshot(userId, snapshotFile);

    const restored = { tasks: 0, events: 0, habits: 0, reminders: 0, total: 0 };
    let missing = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const change of snapshot.plan.tasks) {
        const done = await tx.task
          .updateMany({
            where: { id: change.id, userId },
            data: { dueAt: new Date(change.from) },
          })
          .catch(() => ({ count: 0 }));
        done.count ? (restored.tasks += 1) : (missing += 1);
      }

      for (const change of snapshot.plan.events) {
        const done = await tx.calendarEvent
          .updateMany({
            where: { id: change.id, userId },
            data: { startsAt: new Date(change.from), endsAt: new Date(change.endsFrom) },
          })
          .catch(() => ({ count: 0 }));
        done.count ? (restored.events += 1) : (missing += 1);
      }

      for (const change of snapshot.plan.habits) {
        const done = await tx.routineHabit
          .updateMany({
            where: { id: change.id, userId },
            data: { nextDueAt: new Date(change.from) },
          })
          .catch(() => ({ count: 0 }));
        done.count ? (restored.habits += 1) : (missing += 1);
      }

      for (const change of snapshot.plan.reminders) {
        const done = await tx.reminder
          .updateMany({
            where: { id: change.id, userId },
            data: { remindAt: new Date(change.from) },
          })
          .catch(() => ({ count: 0 }));
        done.count ? (restored.reminders += 1) : (missing += 1);
      }
    });

    restored.total =
      restored.tasks + restored.events + restored.habits + restored.reminders;

    return {
      snapshotFile: path.basename(snapshot.file),
      createdAt: snapshot.createdAt,
      restored,
      missing,
    };
  }

  // ───────────────────────── 内部实现 ─────────────────────────

  private async buildPlan(userId: string, now: Date): Promise<ScheduleResetPlan> {
    const todayStart = this.startOfDay(now);

    const [allTasks, events, habits, reminders] = await Promise.all([
      this.prisma.task.findMany({
        where: { userId, status: { in: [TaskStatus.TODO, TaskStatus.DOING] } },
        select: { id: true, title: true, dueAt: true },
      }),
      this.prisma.calendarEvent.findMany({
        where: { userId, startsAt: { lt: now } },
        select: { id: true, title: true, startsAt: true, endsAt: true },
      }),
      this.prisma.routineHabit.findMany({
        where: { userId, isActive: true, nextDueAt: { lt: now } },
        select: {
          id: true,
          title: true,
          nextDueAt: true,
          intervalValue: true,
          intervalUnit: true,
        },
      }),
      this.prisma.reminder.findMany({
        where: { userId, status: ReminderStatus.PENDING, remindAt: { lt: now } },
        select: { id: true, title: true, remindAt: true, taskId: true, eventId: true },
      }),
    ]);

    // 任务：整体平移（保留相对间隔）
    const overdueTasks = allTasks.filter(
      (task) => task.dueAt !== null && task.dueAt.getTime() < now.getTime(),
    );
    const taskShiftDays = this.getShiftDays(
      overdueTasks
        .map((task) => task.dueAt)
        .filter((dueAt): dueAt is Date => dueAt !== null)
        .filter((dueAt) => dueAt.getTime() < todayStart.getTime()),
      todayStart,
    );

    const taskChanges = overdueTasks.map((task) => {
      const from = task.dueAt as Date;
      const shifted =
        from.getTime() < todayStart.getTime() ? this.addDays(from, taskShiftDays) : from;
      const to = shifted.getTime() <= now.getTime() ? this.nudgeAfterNow(now) : shifted;

      return { id: task.id, title: task.title, from: from.toISOString(), to: to.toISOString() };
    });

    // 倒计时：同样整体平移，保持时长
    const eventShiftDays = this.getShiftDays(
      events
        .map((event) => event.startsAt)
        .filter((startsAt) => startsAt.getTime() < todayStart.getTime()),
      todayStart,
    );

    const eventChanges = events.map((event) => {
      const duration = event.endsAt.getTime() - event.startsAt.getTime();
      const shifted =
        event.startsAt.getTime() < todayStart.getTime()
          ? this.addDays(event.startsAt, eventShiftDays)
          : event.startsAt;
      const startsAt = shifted.getTime() <= now.getTime() ? this.nudgeAfterNow(now) : shifted;
      const endsAt = new Date(Math.max(startsAt.getTime(), startsAt.getTime() + duration));

      return {
        id: event.id,
        title: event.title,
        from: event.startsAt.toISOString(),
        to: startsAt.toISOString(),
        endsFrom: event.endsAt.toISOString(),
        endsTo: endsAt.toISOString(),
      };
    });

    // 例行事项：复用 RoutineService 的周期推进算法
    const habitChanges: ScheduleResetPlan['habits'] = [];

    for (const habit of habits) {
      const { nextDueAt, steps } = this.routine.advanceOverdueNextDueAt(
        habit.nextDueAt,
        habit.intervalValue,
        habit.intervalUnit,
        now,
      );

      if (steps === 0 || steps >= MAX_STEPS) {
        continue;
      }

      habitChanges.push({
        id: habit.id,
        title: habit.title,
        from: habit.nextDueAt.toISOString(),
        to: nextDueAt.toISOString(),
        steps,
      });
    }

    // 提醒：跟随宿主平移，没有宿主或宿主未变则顺延到 1 小时后
    const taskDelta = new Map(
      taskChanges.map((change) => [
        change.id,
        new Date(change.to).getTime() - new Date(change.from).getTime(),
      ]),
    );
    const eventDelta = new Map(
      eventChanges.map((change) => [
        change.id,
        new Date(change.to).getTime() - new Date(change.from).getTime(),
      ]),
    );

    const reminderChanges = reminders.map((reminder) => {
      const delta =
        (reminder.taskId ? taskDelta.get(reminder.taskId) : undefined) ??
        (reminder.eventId ? eventDelta.get(reminder.eventId) : undefined);

      const moved = new Date(reminder.remindAt.getTime() + (delta ?? 0));
      const to = moved.getTime() <= now.getTime() ? this.nudgeAfterNow(now) : moved;

      return {
        id: reminder.id,
        title: reminder.title,
        from: reminder.remindAt.toISOString(),
        to: to.toISOString(),
      };
    });

    const [inactiveDependentHabits, remindersNotPending] = await Promise.all([
      this.prisma.routineHabit.count({
        where: { userId, isActive: false, dependsOnId: { not: null } },
      }),
      this.prisma.reminder.count({
        where: { userId, remindAt: { lt: now }, status: { not: ReminderStatus.PENDING } },
      }),
    ]);

    const counts = {
      tasks: taskChanges.length,
      events: eventChanges.length,
      habits: habitChanges.length,
      reminders: reminderChanges.length,
      total:
        taskChanges.length + eventChanges.length + habitChanges.length + reminderChanges.length,
    };

    return {
      now: now.toISOString(),
      shiftDays: { tasks: taskShiftDays, events: eventShiftDays },
      tasks: taskChanges,
      events: eventChanges,
      habits: habitChanges,
      reminders: reminderChanges,
      counts,
      skipped: {
        inactiveDependentHabits,
        tasksWithoutDueAt: allTasks.filter((task) => task.dueAt === null).length,
        remindersNotPending,
      },
    };
  }

  private async applyPlan(plan: ScheduleResetPlan) {
    await this.prisma.$transaction(async (tx) => {
      for (const change of plan.tasks) {
        await tx.task.update({
          where: { id: change.id },
          data: { dueAt: new Date(change.to) },
        });
      }

      for (const change of plan.events) {
        await tx.calendarEvent.update({
          where: { id: change.id },
          data: { startsAt: new Date(change.to), endsAt: new Date(change.endsTo) },
        });
      }

      for (const change of plan.habits) {
        await tx.routineHabit.update({
          where: { id: change.id },
          data: { nextDueAt: new Date(change.to), lastRemindedAt: null },
        });
      }

      for (const change of plan.reminders) {
        await tx.reminder.update({
          where: { id: change.id },
          data: { remindAt: new Date(change.to) },
        });
      }
    });
  }

  private async writeSnapshot(userId: string, plan: ScheduleResetPlan) {
    const payload: SnapshotPayload = {
      version: 1,
      createdAt: plan.now,
      userId,
      plan,
    };

    await fs.mkdir(this.snapshotDir, { recursive: true });

    const stamp = plan.now.replace(/[:.]/g, '-');
    const file = path.join(this.snapshotDir, `reset-${stamp}.json`);

    await fs.writeFile(file, JSON.stringify(payload, null, 2), 'utf8');
    await this.pruneSnapshots();

    return path.basename(file);
  }

  private async pruneSnapshots() {
    const files = await this.readSnapshotFiles();
    const extra = files.slice(SNAPSHOT_LIMIT);

    for (const item of extra) {
      await fs.rm(item.file, { force: true });
    }
  }

  private async readSnapshotFiles() {
    let names: string[] = [];

    try {
      names = await fs.readdir(this.snapshotDir);
    } catch {
      return [];
    }

    const snapshots: Array<{ file: string; createdAt: string; plan: ScheduleResetPlan }> = [];

    for (const name of names.filter((item) => item.endsWith('.json'))) {
      try {
        const raw = await fs.readFile(path.join(this.snapshotDir, name), 'utf8');
        const parsed = JSON.parse(raw) as SnapshotPayload;
        snapshots.push({ file: path.join(this.snapshotDir, name), createdAt: parsed.createdAt, plan: parsed.plan });
      } catch {
        continue;
      }
    }

    return snapshots.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  private async readSnapshot(userId: string, snapshotFile?: string): Promise<SnapshotPayload & { file: string }> {
    if (snapshotFile) {
      if (!/^[A-Za-z0-9._-]+\.json$/.test(snapshotFile)) {
        throw new NotFoundException('快照文件名不合法');
      }

      const candidate = path.join(this.snapshotDir, snapshotFile);
      const raw = await fs.readFile(candidate, 'utf8').catch(() => null);

      if (!raw) {
        throw new NotFoundException('找不到该快照');
      }

      const parsed = JSON.parse(raw) as SnapshotPayload;

      if (parsed.userId !== userId) {
        throw new NotFoundException('找不到该快照');
      }

      return { ...parsed, file: candidate };
    }

    const files = await this.readSnapshotFiles();
    const latest = files.length > 0 ? files[0] : null;

    if (!latest) {
      throw new NotFoundException('还没有可撤销的重置记录');
    }

    const raw = await fs.readFile(latest.file, 'utf8');
    const parsed = JSON.parse(raw) as SnapshotPayload;

    if (parsed.userId !== userId) {
      throw new NotFoundException('找不到该快照');
    }

    return { ...parsed, file: latest.file };
  }

  private getShiftDays(overdue: Date[], todayStart: Date) {
    if (overdue.length === 0) {
      return 0;
    }

    const anchor = Math.min(...overdue.map((item) => item.getTime()));

    return Math.max(1, Math.ceil((todayStart.getTime() - anchor) / DAY_MS));
  }

  private addDays(date: Date, days: number) {
    return new Date(date.getTime() + days * DAY_MS);
  }

  /** 若平移后仍落在过去，顺延到 1 小时后（整分） */
  private nudgeAfterNow(now: Date) {
    const next = new Date(now.getTime() + NUDGE_MS);

    next.setSeconds(0, 0);

    return next;
  }

  private startOfDay(date: Date) {
    const start = new Date(date);

    start.setHours(0, 0, 0, 0);

    return start;
  }
}
