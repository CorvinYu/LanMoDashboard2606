import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CheckInRoutineHabitBody,
  CreateRoutineHabitBody,
  CreateSleepLogBody,
  RoutineService,
  UpdateRoutineHabitBody,
} from './routine.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class RoutineController {
  constructor(private readonly routine: RoutineService) {}

  @Get('routine-habits')
  listHabits(@CurrentUser() user: AuthenticatedUser) {
    return this.routine.listHabits(user.id);
  }

  @Post('routine-habits')
  createHabit(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateRoutineHabitBody) {
    return this.routine.createHabit(user.id, body);
  }

  @Patch('routine-habits/:id')
  updateHabit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateRoutineHabitBody,
  ) {
    return this.routine.updateHabit(user.id, id, body);
  }

  @Delete('routine-habits/:id')
  removeHabit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.routine.removeHabit(user.id, id);
  }

  @Post('routine-habits/:id/check-ins')
  checkInHabit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CheckInRoutineHabitBody,
  ) {
    return this.routine.checkInHabit(user.id, id, body);
  }

  @Post('routine-habits/:id/skip')
  skipHabit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CheckInRoutineHabitBody,
  ) {
    return this.routine.skipHabit(user.id, id, body);
  }

  @Post('routine-habits/check-overdue')
  checkOverdueHabits(@CurrentUser() user: AuthenticatedUser) {
    return this.routine.checkOverdueHabits(user.id);
  }

  @Get('routine-check-ins/recent')
  listRecentCheckIns(@CurrentUser() user: AuthenticatedUser) {
    return this.routine.listRecentCheckIns(user.id);
  }

  @Get('sleep-logs')
  listSleepLogs(@CurrentUser() user: AuthenticatedUser) {
    return this.routine.listSleepLogs(user.id);
  }

  @Post('sleep-logs')
  createSleepLog(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateSleepLogBody) {
    return this.routine.createSleepLog(user.id, body);
  }
}
