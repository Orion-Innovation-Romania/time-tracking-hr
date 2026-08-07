import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import {
  changePasswordSchema,
  loginSchema,
  type ChangePasswordInput,
  type LoginInput,
  type SessionUser,
} from '@ttah/shared';
import { Public } from '../common/decorators/public.decorator';
import { AllowWhenMustChange } from '../common/decorators/allow-password-change.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { JwtConfig } from '../config/configuration';
import { AuthService } from './auth.service';
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from './cookies';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
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
    // Reissue tokens and refresh session state (mustChangePassword now false).
    const updated = { ...user, mustChangePassword: false };
    const tokens = await this.auth.issueTokens(updated);
    setAuthCookies(res, tokens, this.cookieOpts());
    return updated;
  }
}
