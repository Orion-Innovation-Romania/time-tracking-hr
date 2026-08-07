import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { SessionUser } from '@ttah/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
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
  list() {
    return this.users.list();
  }

  @Get('login-history')
  loginHistory(@Query('limit') limit?: string) {
    return this.prisma.loginHistory.findMany({
      orderBy: { at: 'desc' },
      take: Math.min(Number(limit) || 100, 500),
    });
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
}
