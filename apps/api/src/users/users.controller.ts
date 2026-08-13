import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type SessionUser,
  type UpdateUserInput,
  type UserAccountView,
} from '@ttah/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

@Controller('users')
@Roles('admin')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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
  ): Promise<UserAccountView> {
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
    return user;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput,
    @CurrentUser() actor: SessionUser,
  ): Promise<UserAccountView> {
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
    return user;
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
}
