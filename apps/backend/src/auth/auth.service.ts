import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma.service';
import { AuthenticatedUser, JwtPayload } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async register(input: RegisterDto) {
    const email = this.normalizeEmail(input.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    const passwordHash = await argon2.hash(input.password);

    if (existing) {
      if (!this.canClaimExistingDefaultUser(existing.email, existing.passwordHash)) {
        throw new BadRequestException('这个邮箱已经注册');
      }

      const user = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          displayName: input.displayName?.trim() || existing.displayName,
        },
        select: this.userSelect,
      });

      return this.createAuthResponse(user);
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: input.displayName?.trim() || email,
      },
      select: this.userSelect,
    });

    return this.createAuthResponse(user);
  }

  async login(input: LoginDto) {
    const email = this.normalizeEmail(input.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        ...this.userSelect,
        passwordHash: true,
      },
    });

    if (!user || !(await this.verifyPassword(user.passwordHash, input.password))) {
      throw new UnauthorizedException('邮箱或密码不正确');
    }

    return this.createAuthResponse({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    });
  }

  me(user: AuthenticatedUser) {
    return { user };
  }

  logout() {
    return { ok: true };
  }

  private async verifyPassword(passwordHash: string, password: string) {
    if (passwordHash === 'single-user-mvp') {
      return false;
    }

    try {
      return await argon2.verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  private async createAuthResponse(user: AuthenticatedUser) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      user,
    };
  }

  private canClaimExistingDefaultUser(email: string, passwordHash: string) {
    const defaultEmail = this.normalizeEmail(
      this.config.get<string>('DEFAULT_USER_EMAIL', 'local@example.com'),
    );

    return email === defaultEmail && passwordHash === 'single-user-mvp';
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private readonly userSelect = {
    id: true,
    email: true,
    displayName: true,
  } as const;
}
