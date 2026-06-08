import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { CalendarModule } from './calendar/calendar.module';
import { HealthController } from './health.controller';
import { ElectricityModule } from './electricity/electricity.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { MediaModule } from './media/media.module';
import { RemindersModule } from './reminders/reminders.module';
import { RoutineModule } from './routine/routine.module';
import { ScoresModule } from './scores/scores.module';
import { SuggestionsModule } from './suggestions/suggestions.module';
import { TasksModule } from './tasks/tasks.module';
import { CoreModule } from './core.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CoreModule,
    AuthModule,
    TasksModule,
    CalendarModule,
    ScoresModule,
    RemindersModule,
    AiModule,
    SuggestionsModule,
    IntegrationsModule,
    RoutineModule,
    ElectricityModule,
    MediaModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
