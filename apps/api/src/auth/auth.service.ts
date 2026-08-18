import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { SessionUser } from '@ttah/shared';
import { AuditService } from '../audit/audit.service';
import { resolvePublicAppUrl } from '../common/public-app-url';
import type { JwtConfig } from '../config/configuration';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import {
  PASSWORD_RESET_TTL_MINUTES,
  PASSWORD_RESET_TTL_MS,
  generatePasswordResetToken,
  hashPasswordResetToken,
  passwordResetHashesEqual,
} from './password-reset-token';

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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
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

  /**
   * Always returns ok. Does not reveal whether the email exists.
   * Sends a one-time link when the account is active and has that email.
   */
  async requestPasswordReset(email: string, appUrl: string): Promise<{ ok: true }> {
    const user = await this.users.findByEmail(email);
    if (!user?.isActive || !user.email) return { ok: true };
    if (!appUrl) {
      this.logger.error('Cannot send password reset: public app URL is not configured');
      return { ok: true };
    }

    const { raw, hash } = generatePasswordResetToken();
    await this.users.storePasswordResetToken(
      user.id,
      hash,
      new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    );

    const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(raw)}`;
    try {
      await this.mail.sendPasswordReset({
        to: user.email,
        username: user.username,
        resetUrl,
        expiresMinutes: PASSWORD_RESET_TTL_MINUTES,
      });
      await this.audit.log({
        userId: user.id,
        action: 'request-password-reset',
        entity: 'User',
        entityId: user.id,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send password reset to ${user.username}: ${err instanceof Error ? err.message : err}`,
      );
    }
    return { ok: true };
  }

  async peekPasswordResetToken(rawToken: string): Promise<{ ok: true }> {
    await this.requireValidResetUser(rawToken);
    return { ok: true };
  }

  async completePasswordReset(rawToken: string, newPassword: string): Promise<{ ok: true }> {
    const user = await this.requireValidResetUser(rawToken);
    const same = await this.users.verify(user.passwordHash, newPassword);
    if (same) {
      throw new BadRequestException('New password must be different from the current one');
    }
    await this.users.setPassword(user.id, newPassword, false);
    await this.audit.log({
      userId: user.id,
      action: 'complete-password-reset',
      entity: 'User',
      entityId: user.id,
    });
    return { ok: true };
  }

  private async requireValidResetUser(rawToken: string) {
    const hash = hashPasswordResetToken(rawToken);
    const user = await this.users.findByPasswordResetTokenHash(hash);
    const now = Date.now();
    if (!user?.isActive || !user.passwordResetTokenHash || !user.passwordResetExpiresAt) {
      throw new BadRequestException('This reset link is invalid or has expired.');
    }
    if (user.passwordResetExpiresAt.getTime() <= now) {
      throw new BadRequestException('This reset link is invalid or has expired.');
    }
    if (!passwordResetHashesEqual(user.passwordResetTokenHash, hash)) {
      throw new BadRequestException('This reset link is invalid or has expired.');
    }
    return user;
  }

  /** Browser origin for reset links. Prefer config; fall back to forwarded host. */
  resolveAppUrl(req: Request): string {
    return resolvePublicAppUrl(this.config, req);
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
