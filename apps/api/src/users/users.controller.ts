import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type CreateUserResult,
  type SessionUser,
  type UpdateUserInput,
  type UpdateUserResult,
  type UserAccountView,
} from '@ttah/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { resolvePublicAppUrl } from '../common/public-app-url';
import { AuditService } from '../audit/audit.service';
import { mailErrorMessage, MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

@Controller('users')
@Roles('admin')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  list(): Promise<UserAccountView[]> {
    return this.users.list();
  }

  @Get('login-history')
  loginHistory(@Query('limit') limit?: string) {
    return this.prisma.loginHistory.findMany({
      orderBy: { at: 'desc' },
      take: Math.min(Number(limit) || 100, 500),
    });
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput,
    @CurrentUser() actor: SessionUser,
    @Req() req: Request,
  ): Promise<CreateUserResult> {
    const user = await this.users.create(body);
    await this.audit.log({
      userId: actor.id,
      action: 'create-user',
      entity: 'User',
      entityId: user.id,
      after: {
        username: user.username,
        role: user.role,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });

    const welcome = await this.sendInitialPasswordEmail(user, body.initialPassword, req, 'welcome');
    return {
      ...user,
      welcomeEmail: welcome.status,
      welcomeEmailError: welcome.error,
    };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput,
    @CurrentUser() actor: SessionUser,
    @Req() req: Request,
  ): Promise<UpdateUserResult> {
    const before = await this.users.findById(id);
    const user = await this.users.update(id, body);
    await this.audit.log({
      userId: actor.id,
      action: 'update-user',
      entity: 'User',
      entityId: id,
      before: before
        ? {
            role: before.role,
            isActive: before.isActive,
            email: before.email,
            firstName: before.firstName,
            lastName: before.lastName,
          }
        : undefined,
      after: {
        role: user.role,
        isActive: user.isActive,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        initialPasswordUpdated: Boolean(body.initialPassword),
      },
    });
    if (!body.initialPassword) return user;
    const mailed = await this.sendInitialPasswordEmail(user, body.initialPassword, req, 'admin-set');
    return {
      ...user,
      passwordEmail: mailed.status,
      passwordEmailError: mailed.error,
    };
  }

  @Post(':id/reset-password')
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: SessionUser,
  ) {
    await this.users.resetToInitial(id);
    await this.audit.log({
      userId: actor.id,
      action: 'reset-password',
      entity: 'User',
      entityId: id,
    });
    return { ok: true };
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: SessionUser,
  ) {
    const user = await this.users.remove(id, actor.id);
    await this.audit.log({
      userId: actor.id,
      action: 'delete-user',
      entity: 'User',
      entityId: id,
      after: { username: user.username, deactivated: true },
    });
    return { ok: true };
  }

  private async sendInitialPasswordEmail(
    user: UserAccountView,
    initialPassword: string,
    req: Request,
    kind: 'welcome' | 'admin-set',
  ): Promise<{ status: CreateUserResult['welcomeEmail']; error: string | null }> {
    if (!(await this.mail.isReady())) {
      return { status: 'skipped', error: 'Mail is not configured' };
    }
    const appUrl = resolvePublicAppUrl(this.config, req);
    if (!appUrl) {
      return { status: 'skipped', error: 'Public app URL is not configured' };
    }
    if (!user.email) {
      return { status: 'skipped', error: 'User has no email' };
    }

    const payload = {
      to: user.email,
      firstName: user.firstName || user.username,
      username: user.username,
      initialPassword,
      loginUrl: `${appUrl}/login`,
    };
    try {
      if (kind === 'welcome') {
        await this.mail.sendWelcomeAccount(payload);
      } else {
        await this.mail.sendAdminSetPassword(payload);
      }
      await this.audit.log({
        userId: user.id,
        action: kind === 'welcome' ? 'send-welcome-email' : 'send-password-email',
        entity: 'User',
        entityId: user.id,
        after: { to: user.email },
      });
      return { status: 'sent', error: null };
    } catch (err) {
      const message = mailErrorMessage(err);
      this.logger.error(`Password email failed for ${user.username}: ${message}`);
      return { status: 'failed', error: message };
    }
  }
}
