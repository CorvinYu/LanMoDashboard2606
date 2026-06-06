import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [IntegrationsModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
