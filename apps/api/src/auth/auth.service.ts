import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { SessionUser } from '@ttah/shared';
import type { JwtConfig } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

export interface RequestContext {
  ip?: string | null;
  userAgent?: string | null;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateUser(username: string, password: string, ctx: RequestContext) {
    const now = new Date();
    const loginCfg = this.config.get<{ maxAttempts: number; lockMinutes: number }>('login')!;
    const user = await this.users.findByUsername(username);

    if (!user || !user.isActive) {
      await this.recordHistory(null, username, ctx, false);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > now) {
      await this.recordHistory(user.id, username, ctx, false);
      throw new UnauthorizedException('Account temporarily locked. Try again later.');
    }

    const ok = await this.users.verify(user.passwordHash, password);
    if (!ok) {
      const attempts = user.failedAttempts + 1;
      const shouldLock = attempts >= loginCfg.maxAttempts;
      const lockedUntil = shouldLock
        ? new Date(now.getTime() + loginCfg.lockMinutes * 60000)
        : null;
      await this.users.setLock(user.id, shouldLock ? 0 : attempts, lockedUntil);
      await this.recordHistory(user.id, username, ctx, false);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.users.markLogin(user.id);
    await this.recordHistory(user.id, username, ctx, true);
    return user;
  }

  async issueTokens(user: { id: number; username: string; role: string }): Promise<TokenPair> {
    const jwtCfg = this.config.get<JwtConfig>('jwt')!;
    const access = await this.jwt.signAsync(
      { sub: user.id, username: user.username, role: user.role, typ: 'access' },
      { secret: jwtCfg.accessSecret, expiresIn: jwtCfg.accessTtl },
    );
    const refresh = await this.jwt.signAsync(
      { sub: user.id, typ: 'refresh' },
      { secret: jwtCfg.refreshSecret, expiresIn: jwtCfg.refreshTtl },
    );
    return { access, refresh };
  }

  async rotateFromRefresh(refreshToken: string): Promise<{ tokens: TokenPair; user: SessionUser }> {
    const jwtCfg = this.config.get<JwtConfig>('jwt')!;
    let payload: { sub: number; typ: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: jwtCfg.refreshSecret });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.typ !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const tokens = await this.issueTokens(user);
    return { tokens, user: this.toSessionUser(user) };
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    const ok = await this.users.verify(user.passwordHash, currentPassword);
    if (!ok) throw new BadRequestException('Current password is incorrect');
    await this.users.setPassword(userId, newPassword, false);
  }

  toSessionUser(user: {
    id: number;
    username: string;
    role: string;
    mustChangePassword: boolean;
  }): SessionUser {
    return {
      id: user.id,
      username: user.username,
      role: user.role as SessionUser['role'],
      mustChangePassword: user.mustChangePassword,
    };
  }

  private recordHistory(
    userId: number | null,
    username: string,
    ctx: RequestContext,
    success: boolean,
  ) {
    return this.prisma.loginHistory.create({
      data: {
        userId: userId ?? undefined,
        username,
        ip: ctx.ip ?? undefined,
        userAgent: ctx.userAgent ?? undefined,
        success,
      },
    });
  }
}
