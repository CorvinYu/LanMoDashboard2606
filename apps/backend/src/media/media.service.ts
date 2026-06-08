import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  MediaRatingProvider,
  MediaReviewStatus,
  MediaWorkType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';

export type MediaExternalRatingBody = {
  provider: MediaRatingProvider;
  ratingValue: number;
  ratingScale?: number;
  ratingCount?: number | null;
  sourceUrl?: string;
  fetchedAt?: string | null;
};

export type CreateMediaReviewBody = {
  title: string;
  originalTitle?: string;
  workType: MediaWorkType;
  releaseDate?: string | null;
  creator?: string;
  coverUrl?: string;
  description?: string;
  language?: string;
  country?: string;
  status?: MediaReviewStatus;
  personalScore: number;
  completedAt?: string | null;
  reviewedAt: string;
  note?: string;
  externalRatings?: MediaExternalRatingBody[];
};

export type UpdateMediaReviewBody = Partial<CreateMediaReviewBody>;

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) {}

  async listReviews(userId: string) {
    return this.prisma.mediaReview.findMany({
      where: { userId },
      include: {
        work: {
          include: {
            externalRatings: {
              orderBy: [{ provider: 'asc' }, { createdAt: 'desc' }],
            },
          },
        },
      },
      orderBy: [{ reviewedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createReview(userId: string, body: CreateMediaReviewBody) {
    const normalized = this.normalizeInput(body);
    const externalRatings = normalized.externalRatings ?? [];

    return this.prisma.$transaction(async (tx) => {
      const work = await tx.mediaWork.create({
        data: {
          userId,
          title: normalized.title!,
          originalTitle: normalized.originalTitle ?? null,
          workType: normalized.workType!,
          releaseDate: normalized.releaseDate ?? null,
          creator: normalized.creator ?? null,
          coverUrl: normalized.coverUrl ?? null,
          description: normalized.description ?? null,
          language: normalized.language ?? null,
          country: normalized.country ?? null,
          externalRatings: externalRatings.length
            ? {
                create: externalRatings,
              }
            : undefined,
        },
      });

      return tx.mediaReview.create({
        data: {
          userId,
          workId: work.id,
          status: normalized.status!,
          personalScore: normalized.personalScore!,
          completedAt: normalized.completedAt ?? null,
          reviewedAt: normalized.reviewedAt!,
          note: normalized.note ?? null,
        },
        include: {
          work: {
            include: {
              externalRatings: {
                orderBy: [{ provider: 'asc' }, { createdAt: 'desc' }],
              },
            },
          },
        },
      });
    });
  }

  async updateReview(userId: string, id: string, body: UpdateMediaReviewBody) {
    const review = await this.ensureOwnReview(userId, id);
    const normalized = this.normalizeInput(body, true);

    return this.prisma.$transaction(async (tx) => {
      if (Object.keys(normalized.workData).length > 0 || normalized.externalRatings) {
        await tx.mediaWork.update({
          where: { id: review.workId },
          data: {
            ...normalized.workData,
            ...(normalized.externalRatings
              ? {
                  externalRatings: {
                    deleteMany: {},
                    ...(normalized.externalRatings.length
                      ? { create: normalized.externalRatings }
                      : {}),
                  },
                }
              : {}),
          },
        });
      }

      return tx.mediaReview.update({
        where: { id },
        data: normalized.reviewData,
        include: {
          work: {
            include: {
              externalRatings: {
                orderBy: [{ provider: 'asc' }, { createdAt: 'desc' }],
              },
            },
          },
        },
      });
    });
  }

  async deleteReview(userId: string, id: string) {
    const review = await this.ensureOwnReview(userId, id);

    return this.prisma.$transaction(async (tx) => {
      await tx.mediaReview.delete({
        where: { id },
      });

      return tx.mediaWork.delete({
        where: { id: review.workId },
      });
    });
  }

  private normalizeInput(body: CreateMediaReviewBody | UpdateMediaReviewBody, partial = false) {
    const workData: Prisma.MediaWorkUpdateInput = {};
    const reviewData: Prisma.MediaReviewUpdateInput = {};

    if (!partial || body.title !== undefined) {
      if (!body.title?.trim()) {
        throw new BadRequestException('请输入作品标题');
      }

      workData.title = body.title.trim();
    }

    if (!partial || body.workType !== undefined) {
      if (!body.workType || !this.isWorkType(body.workType)) {
        throw new BadRequestException('作品类型不正确');
      }

      workData.workType = body.workType;
    }

    if (body.originalTitle !== undefined) {
      workData.originalTitle = body.originalTitle.trim() || null;
    }

    if (body.releaseDate !== undefined) {
      workData.releaseDate = body.releaseDate ? this.parseDate(body.releaseDate, '发布日期不正确') : null;
    }

    if (body.creator !== undefined) {
      workData.creator = body.creator.trim() || null;
    }

    if (body.coverUrl !== undefined) {
      workData.coverUrl = body.coverUrl.trim() || null;
    }

    if (body.description !== undefined) {
      workData.description = body.description.trim() || null;
    }

    if (body.language !== undefined) {
      workData.language = body.language.trim() || null;
    }

    if (body.country !== undefined) {
      workData.country = body.country.trim() || null;
    }

    if (!partial || body.personalScore !== undefined) {
      reviewData.personalScore = this.parsePersonalScore(body.personalScore);
    }

    if (!partial || body.reviewedAt !== undefined) {
      reviewData.reviewedAt = this.parseDate(body.reviewedAt, '评分时间不正确');
    }

    if (body.completedAt !== undefined) {
      reviewData.completedAt = body.completedAt ? this.parseDate(body.completedAt, '完成时间不正确') : null;
    }

    if (!partial || body.status !== undefined) {
      const status = body.status ?? 'COMPLETED';

      if (!this.isReviewStatus(status)) {
        throw new BadRequestException('评分状态不正确');
      }

      reviewData.status = status;
    }

    if (body.note !== undefined) {
      reviewData.note = body.note.trim() || null;
    }

    return {
      title: workData.title as string | undefined,
      originalTitle: workData.originalTitle as string | null | undefined,
      workType: workData.workType as MediaWorkType | undefined,
      releaseDate: workData.releaseDate as Date | null | undefined,
      creator: workData.creator as string | null | undefined,
      coverUrl: workData.coverUrl as string | null | undefined,
      description: workData.description as string | null | undefined,
      language: workData.language as string | null | undefined,
      country: workData.country as string | null | undefined,
      status: reviewData.status as MediaReviewStatus | undefined,
      personalScore: reviewData.personalScore as number | undefined,
      completedAt: reviewData.completedAt as Date | null | undefined,
      reviewedAt: reviewData.reviewedAt as Date | undefined,
      note: reviewData.note as string | null | undefined,
      workData,
      reviewData,
      externalRatings:
        body.externalRatings === undefined
          ? undefined
          : body.externalRatings.map((rating, index) => this.normalizeExternalRating(rating, index)),
    };
  }

  private normalizeExternalRating(rating: MediaExternalRatingBody, index: number) {
    if (!rating.provider || !this.isRatingProvider(rating.provider)) {
      throw new BadRequestException(`第 ${index + 1} 条外部评分来源不正确`);
    }

    const ratingValue = Number(rating.ratingValue);
    const ratingScale = Number(rating.ratingScale ?? 10);

    if (!Number.isFinite(ratingValue) || ratingValue < 0) {
      throw new BadRequestException(`第 ${index + 1} 条外部评分值不正确`);
    }

    if (!Number.isInteger(ratingScale) || ratingScale <= 0) {
      throw new BadRequestException(`第 ${index + 1} 条外部分制不正确`);
    }

    if (ratingValue > ratingScale) {
      throw new BadRequestException(`第 ${index + 1} 条外部评分不能大于分制`);
    }

    if (
      rating.ratingCount !== undefined &&
      rating.ratingCount !== null &&
      (!Number.isInteger(rating.ratingCount) || rating.ratingCount < 0)
    ) {
      throw new BadRequestException(`第 ${index + 1} 条外部评分人数不正确`);
    }

    return {
      provider: rating.provider,
      ratingValue,
      ratingScale,
      ratingCount: rating.ratingCount ?? null,
      sourceUrl: rating.sourceUrl?.trim() || null,
      fetchedAt: rating.fetchedAt ? this.parseDate(rating.fetchedAt, `第 ${index + 1} 条抓取时间不正确`) : null,
    };
  }

  private parseDate(value: string | undefined, message: string) {
    const date = value ? new Date(value) : null;

    if (!date || Number.isNaN(date.getTime())) {
      throw new BadRequestException(message);
    }

    return date;
  }

  private parsePersonalScore(value: number | undefined) {
    const score = Number(value);

    if (!Number.isInteger(score) || score < 0 || score > 100) {
      throw new BadRequestException('个人评分需要是 0 到 100 的整数');
    }

    return score;
  }

  private isWorkType(value: string): value is MediaWorkType {
    return ['BOOK', 'MOVIE', 'SERIES', 'ANIME', 'GAME', 'OTHER'].includes(value);
  }

  private isReviewStatus(value: string): value is MediaReviewStatus {
    return ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'DROPPED'].includes(value);
  }

  private isRatingProvider(value: string): value is MediaRatingProvider {
    return ['DOUBAN', 'ROTTEN_TOMATOES', 'IMDB', 'METACRITIC', 'OTHER'].includes(value);
  }

  private async ensureOwnReview(userId: string, id: string) {
    const review = await this.prisma.mediaReview.findFirst({
      where: { id, userId },
      select: { id: true, workId: true },
    });

    if (!review) {
      throw new NotFoundException('作品评分记录不存在');
    }

    return review;
  }
}
