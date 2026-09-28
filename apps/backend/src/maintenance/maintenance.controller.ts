import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MaintenanceService } from './maintenance.service';

@Controller('maintenance')
@UseGuards(JwtAuthGuard)
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  /** 预览：把逾期内容恢复到今天之后的计划（不写库） */
  @Post('reset-schedule/preview')
  preview(@CurrentUser() user: AuthenticatedUser) {
    return this.maintenance.previewScheduleReset(user.id);
  }

  /** 执行重置；body.dryRun = true 时仅返回计划 */
  @Post('reset-schedule')
  reset(@CurrentUser() user: AuthenticatedUser, @Body() body: { dryRun?: boolean }) {
    return this.maintenance.resetSchedule(user.id, body?.dryRun ?? false);
  }

  /** 历史快照列表（用于展示可撤销的记录） */
  @Get('reset-schedule/snapshots')
  snapshots() {
    return this.maintenance.listSnapshots();
  }

  /** 撤销一次重置（默认撤销最新一次） */
  @Post('reset-schedule/undo')
  undo(@CurrentUser() user: AuthenticatedUser, @Body() body: { snapshotFile?: string }) {
    return this.maintenance.undoLastReset(user.id, body?.snapshotFile);
  }
}
