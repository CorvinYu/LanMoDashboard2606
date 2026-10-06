// 每日自动归档：把「昨天及更早完成」的任务标记为 ARCHIVED。
//
// 背景（2026-10-06）：原先这段逻辑挂在 TasksService.list() 里，是**惰性副作用**——
// 用户不打开任务面板就不会归档，导致「已完成任务」列表可能残留多天。
// 现在改为由调度器每天 00:05 主动执行，覆盖所有用户。
//
// 设计约束：
// - 复用 TasksService 已有的归档语义（DONE 且 completedAt < 今天 00:00 → ARCHIVED），不另写规则
// - 遍历全部用户（原实现只处理当前登录用户）
// - 单用户失败不影响其他用户；整体失败只记日志，不抛出（避免调度器反复报错）

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { TasksService } from './tasks.service';

@Injectable()
export class TasksArchiveScheduler {
  private readonly logger = new Logger(TasksArchiveScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
  ) {}

  // 每天 00:05 执行（服务器本地时区，即 Asia/Shanghai）
  @Cron('0 5 0 * * *', { name: 'daily-task-archive' })
  async archiveDaily(): Promise<void> {
    await this.runArchive('cron');
  }

  /**
   * 执行一次全量归档。返回受影响的任务数，便于测试与手动触发。
   */
  async runArchive(trigger: 'cron' | 'manual' = 'manual'): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let total = 0;
    try {
      const users = await this.prisma.user.findMany({ select: { id: true } });

      for (const user of users) {
        try {
          total += await this.tasksService.archiveCompletedBefore(user.id, todayStart);
        } catch (error) {
          this.logger.error(
            `归档失败 userId=${user.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      this.logger.log(`每日归档完成（${trigger}）：${users.length} 个用户，共归档 ${total} 条`);
    } catch (error) {
      this.logger.error(
        `每日归档整体失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return total;
  }
}
