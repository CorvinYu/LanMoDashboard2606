import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateElectricityReadingBody,
  ElectricityService,
  UpdateElectricityReadingBody,
} from './electricity.service';

@Controller('electricity')
@UseGuards(JwtAuthGuard)
export class ElectricityController {
  constructor(private readonly electricity: ElectricityService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.electricity.getSummary(user.id);
  }

  @Get('readings')
  listReadings(@CurrentUser() user: AuthenticatedUser) {
    return this.electricity.listReadings(user.id);
  }

  @Post('readings')
  createReading(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateElectricityReadingBody) {
    return this.electricity.createReading(user.id, body);
  }

  @Patch('readings/:id')
  updateReading(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateElectricityReadingBody,
  ) {
    return this.electricity.updateReading(user.id, id, body);
  }

  @Delete('readings/:id')
  deleteReading(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.electricity.deleteReading(user.id, id);
  }
}
