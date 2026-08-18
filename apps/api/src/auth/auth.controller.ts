import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  type ResetPasswordInput,
  type SessionUser,
} from '@ttah/shared';
import { Public } from '../common/decorators/public.decorator';
import { AllowWhenMustChange } from '../common/decorators/allow-password-change.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { JwtConfig } from '../config/configuration';
import { MailService } from '../mail/mail.service';
import { MemoryRateLimit } from '../common/memory-rate-limit';
import { AuthService } from './auth.service';
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from './cookies';

@Controller('auth')
export class AuthController {
  /** 5 attempts / 15 min per IP, 3 / 15 min per email. */
  private readonly forgotByIp = new MemoryRateLimit(5, 15 * 60 * 1000);
  private readonly forgotByEmail = new MemoryRateLimit(3, 15 * 60 * 1000);
  private readonly resetByIp = new MemoryRateLimit(10, 15 * 60 * 1000);

  constructor(
    private readonly auth: AuthService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private cookieOpts() {
    const jwt = this.config.get<JwtConfig>('jwt')!;
    return {
      secure: this.config.get<boolean>('cookieSecure') ?? false,
      accessTtl: jwt.accessTtl,
      refreshTtl: jwt.refreshTtl,
    };
  }

  @Public()
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser> {
    const user = await this.auth.validateUser(body.username, body.password, {
      ip: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
    const tokens = await this.auth.issueTokens(user);
    setAuthCookies(res, tokens, this.cookieOpts());
    return this.auth.toSessionUser(user);
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordInput,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    if (!(await this.mail.isReady())) {
      throw new ServiceUnavailableException(
        'Password reset is unavailable because mail is not configured. Ask an administrator.',
      );
    }
    const appUrl = this.auth.resolveAppUrl(req);
    if (!appUrl) {
      throw new ServiceUnavailableException(
        'Password reset is unavailable. Ask an administrator.',
      );
    }
    const ip = req.ip ?? 'unknown';
    const emailKey = body.email.trim().toLowerCase();
    if (!this.forgotByIp.try(`ip:${ip}`) || !this.forgotByEmail.try(`email:${emailKey}`)) {
      throw new HttpException(
        'Too many reset requests. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return this.auth.requestPasswordReset(body.email, appUrl);
  }

  @Public()
  @Get('reset-password')
  peekResetPassword(@Query('token') token: string): Promise<{ ok: true }> {
    const parsed = resetPasswordSchema.pick({ token: true }).safeParse({ token });
    if (!parsed.success) {
      throw new HttpException('This reset link is invalid or has expired.', HttpStatus.BAD_REQUEST);
    }
    return this.auth.peekPasswordResetToken(parsed.data.token);
  }

  @Public()
  @Post('reset-password')
  completeResetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    this.assertResetNotLimited(req);
    return this.auth.completePasswordReset(body.token, body.newPassword);
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser> {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('No refresh token');
    const { tokens, user } = await this.auth.rotateFromRefresh(token);
    setAuthCookies(res, tokens, this.cookieOpts());
    return user;
  }

  @AllowWhenMustChange()
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    clearAuthCookies(res, this.config.get<boolean>('cookieSecure') ?? false);
    return { ok: true };
  }

  @AllowWhenMustChange()
  @Get('me')
  me(@CurrentUser() user: SessionUser): SessionUser {
    return user;
  }

  @AllowWhenMustChange()
  @Post('change-password')
  async changePassword(
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
    @CurrentUser() user: SessionUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser> {
    await this.auth.changePassword(user.id, body.currentPassword, body.newPassword);
    const updated = { ...user, mustChangePassword: false };
    const tokens = await this.auth.issueTokens(updated);
    setAuthCookies(res, tokens, this.cookieOpts());
    return updated;
  }

  private assertResetNotLimited(req: Request) {
    const ip = req.ip ?? 'unknown';
    if (!this.resetByIp.try(`reset:${ip}`)) {
      throw new HttpException(
        'Too many reset attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
