import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CalendarService,
  CreateCalendarEventBody,
  UpdateCalendarEventBody,
} from './calendar.service';

@Controller('calendar-events')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('today')
  listToday(@CurrentUser() user: AuthenticatedUser) {
    return this.calendar.listToday(user.id);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.calendar.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateCalendarEventBody) {
    return this.calendar.create(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateCalendarEventBody,
  ) {
    return this.calendar.update(user.id, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.calendar.remove(user.id, id);
  }
}
