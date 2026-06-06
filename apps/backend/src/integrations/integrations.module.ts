import { Module } from '@nestjs/common';
import { MicrosoftTodoController } from './microsoft-todo.controller';
import { MicrosoftTodoService } from './microsoft-todo.service';

@Module({
  controllers: [MicrosoftTodoController],
  providers: [MicrosoftTodoService],
  exports: [MicrosoftTodoService],
})
export class IntegrationsModule {}
