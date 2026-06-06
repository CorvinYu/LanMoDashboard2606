import { Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MicrosoftTodoService } from './microsoft-todo.service';

@Controller('integrations/microsoft-todo')
export class MicrosoftTodoController {
  constructor(private readonly microsoftTodo: MicrosoftTodoService) {}

  @Get('auth-url')
  @UseGuards(JwtAuthGuard)
  getAuthUrl() {
    return this.microsoftTodo.getAuthUrl();
  }

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() response: { redirect: (url: string) => void },
  ) {
    const redirectUrl = await this.microsoftTodo.handleCallback({
      code,
      state,
      error,
    });

    return response.redirect(redirectUrl);
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard)
  sync(@CurrentUser() user: AuthenticatedUser) {
    return this.microsoftTodo.sync(user.id);
  }

  @Post('push')
  @UseGuards(JwtAuthGuard)
  push(@CurrentUser() user: AuthenticatedUser) {
    return this.microsoftTodo.pushLocalTasks(user.id);
  }
}
