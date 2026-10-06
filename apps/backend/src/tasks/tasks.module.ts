import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { TasksArchiveScheduler } from './tasks-archive.scheduler';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [IntegrationsModule],
  controllers: [TasksController],
  providers: [TasksService, TasksArchiveScheduler],
  exports: [TasksArchiveScheduler],
})
export class TasksModule {}
