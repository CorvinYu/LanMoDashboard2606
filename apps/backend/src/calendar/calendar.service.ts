import { Injectable, NotFoundException } from '@nestjs/common';
import { Priority } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export type CreateCalendarEventBody = {
  title: string;
  description?: string;
  startsAt: string;
  priority?: Priority;
  location?: string;
};

export type UpdateCalendarEventBody = Partial<CreateCalendarEventBody>;

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const events = await this.prisma.calendarEvent.findMany({
      where: {
        userId,
        startsAt: {
          gte: new Date(),
        },
      },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'desc' }],
    });

    return this.sortEvents(events);
  }

  async create(userId: string, body: CreateCalendarEventBody) {
    const startsAt = new Date(body.startsAt);

    return this.prisma.calendarEvent.create({
      data: {
        userId,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        startsAt,
        endsAt: startsAt,
        priority: body.priority ?? 'MEDIUM',
        location: body.location?.trim() || null,
      },
    });
  }

  async update(userId: string, id: string, body: UpdateCalendarEventBody) {
    await this.ensureOwnEvent(id, userId);
    const startsAt = body.startsAt ? new Date(body.startsAt) : undefined;

    return this.prisma.calendarEvent.update({
      where: { id },
      data: {
        title: body.title?.trim(),
        description:
          body.description === undefined ? undefined : body.description.trim() || null,
        startsAt,
        endsAt: startsAt,
        priority: body.priority,
        location: body.location === undefined ? undefined : body.location.trim() || null,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.ensureOwnEvent(id, userId);

    return this.prisma.calendarEvent.delete({
      where: { id },
    });
  }

  private sortEvents<T extends { startsAt: Date; priority: Priority }>(events: T[]) {
    return [...events].sort((left, right) => {
      const timeDiff = left.startsAt.getTime() - right.startsAt.getTime();

      if (Math.abs(timeDiff) > 86_400_000) {
        return timeDiff;
      }

      return this.priorityWeight(right.priority) - this.priorityWeight(left.priority) || timeDiff;
    });
  }

  private priorityWeight(priority: Priority) {
    if (priority === 'HIGH') {
      return 3;
    }

    if (priority === 'MEDIUM') {
      return 2;
    }

    return 1;
  }

  private async ensureOwnEvent(id: string, userId: string) {
    const event = await this.prisma.calendarEvent.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!event) {
      throw new NotFoundException('倒计时不存在');
    }
  }
}
