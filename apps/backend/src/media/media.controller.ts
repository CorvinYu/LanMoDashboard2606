import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateMediaReviewBody,
  MediaService,
  UpdateMediaReviewBody,
} from './media.service';

@Controller('media-reviews')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  listReviews(@CurrentUser() user: AuthenticatedUser) {
    return this.media.listReviews(user.id);
  }

  @Post()
  createReview(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateMediaReviewBody) {
    return this.media.createReview(user.id, body);
  }

  @Patch(':id')
  updateReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateMediaReviewBody,
  ) {
    return this.media.updateReview(user.id, id, body);
  }

  @Delete(':id')
  deleteReview(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.media.deleteReview(user.id, id);
  }
}
