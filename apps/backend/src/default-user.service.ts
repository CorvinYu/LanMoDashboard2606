import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

@Injectable()
export class DefaultUserService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async getUserId() {
    const email = this.config.get<string>('DEFAULT_USER_EMAIL', 'local@example.com');
    const displayName = this.config.get<string>('DEFAULT_USER_NAME', '本地用户');

    const user = await this.prisma.user.upsert({
      where: { email },
      update: { displayName },
      create: {
        email,
        displayName,
        passwordHash: 'single-user-mvp',
      },
      select: { id: true },
    });

    return user.id;
  }
}
