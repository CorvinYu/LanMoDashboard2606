import { Injectable, NotFoundException } from '@nestjs/common';
import { Priority, TaskStatus } from '@prisma/client';
import { MicrosoftTodoService } from '../integrations/microsoft-todo.service';
import { PrismaService } from '../prisma.service';

export type CreateTaskBody = {
  title: string;
  description?: string;
  priority?: Priority;
  dueAt?: string | null;
};

export type UpdateTaskBody = Partial<CreateTaskBody> & {
  status?: TaskStatus;
};

type ListedTask = Awaited<ReturnType<PrismaService['task']['findMany']>>[number];

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly microsoftTodo: MicrosoftTodoService,
  ) {}

  async list(userId: string) {
    const { todayStart, tomorrowStart } = this.getTodayRange();

    await this.archiveOldDoneTasks(userId, todayStart);

    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        status: { not: 'ARCHIVED' },
        OR: [
          {
            status: { not: 'DONE' },
          },
          {
            status: 'DONE',
            completedAt: {
              gte: todayStart,
              lt: tomorrowStart,
            },
          },
        ],
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return this.sortTasks(tasks, new Date());
  }

  async create(userId: string, body: CreateTaskBody) {
    return this.prisma.task.create({
      data: {
        userId,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        priority: body.priority ?? 'MEDIUM',
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
      },
    });
  }

  async update(userId: string, id: string, body: UpdateTaskBody) {
    await this.ensureOwnTask(id, userId);

    return this.prisma.task.update({
      where: { id },
      data: {
        title: body.title?.trim(),
        description:
          body.description === undefined ? undefined : body.description.trim() || null,
        priority: body.priority,
        status: body.status,
        dueAt: body.dueAt === undefined ? undefined : body.dueAt ? new Date(body.dueAt) : null,
        completedAt:
          body.status === 'DONE' ? new Date() : body.status === undefined ? undefined : null,
      },
    });
  }

  async complete(userId: string, id: string) {
    await this.ensureOwnTask(id, userId);

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        status: 'DONE',
        completedAt: new Date(),
      },
    });

    await this.microsoftTodo.completeLinkedTask(userId, id).catch(() => undefined);

    return task;
  }

  async restore(userId: string, id: string) {
    await this.ensureOwnTask(id, userId);

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        status: 'TODO',
        completedAt: null,
      },
    });

    await this.microsoftTodo.restoreLinkedTask(userId, id).catch(() => undefined);

    return task;
  }

  async remove(userId: string, id: string) {
    await this.ensureOwnTask(id, userId);

    return this.prisma.task.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
      },
    });
  }

  private async archiveOldDoneTasks(userId: string, todayStart: Date) {
    await this.prisma.task.updateMany({
      where: {
        userId,
        status: 'DONE',
        completedAt: {
          lt: todayStart,
        },
      },
      data: {
        status: 'ARCHIVED',
      },
    });
  }

  private getTodayRange() {
    const todayStart = new Date();

    todayStart.setHours(0, 0, 0, 0);

    const tomorrowStart = new Date(todayStart);

    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    return { todayStart, tomorrowStart };
  }

  private sortTasks(tasks: ListedTask[], now: Date) {
    return [...tasks].sort((left, right) => {
      const leftScore = this.getTaskSortScore(left, now);
      const rightScore = this.getTaskSortScore(right, now);

      return leftScore - rightScore;
    });
  }

  private getTaskSortScore(task: ListedTask, now: Date) {
    if (task.status === 'DONE') {
      return 1_000_000 + (task.completedAt?.getTime() ?? task.updatedAt.getTime());
    }

    const priorityScore = this.getPriorityScore(task.priority);
    const dueScore = this.getDueScore(task.dueAt, now);
    const recencyScore = Math.max(0, 10_000 - Math.floor((now.getTime() - task.createdAt.getTime()) / 86_400_000));

    return dueScore - priorityScore - recencyScore / 100;
  }

  private getDueScore(dueAt: Date | null, now: Date) {
    if (!dueAt) {
      return 500_000;
    }

    const diffHours = (dueAt.getTime() - now.getTime()) / 3_600_000;

    if (diffHours < 0) {
      return -100_000 + diffHours;
    }

    if (diffHours <= 24) {
      return diffHours * 100;
    }

    if (diffHours <= 72) {
      return 2_400 + (diffHours - 24) * 50;
    }

    return 10_000 + diffHours;
  }

  private getPriorityScore(priority: Priority) {
    if (priority === 'HIGH') {
      return 2_000;
    }

    if (priority === 'MEDIUM') {
      return 1_000;
    }

    return 0;
  }

  private async ensureOwnTask(id: string, userId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!task) {
      throw new NotFoundException('任务不存在');
    }
  }
}
