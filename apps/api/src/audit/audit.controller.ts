import { Controller, Get, Query } from '@nestjs/common';
import type { SessionUser } from '@ttah/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @CurrentUser() user: SessionUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('userId') userId?: string,
  ) {
    // Non-admins can only ever see their own actions; admins may filter by user.
    const scopedUserId =
      user.role === 'admin' ? (userId ? Number(userId) : null) : user.id;
    return this.audit.list(
      Math.min(Number(limit) || 100, 500),
      Number(offset) || 0,
      scopedUserId,
    );
  }
}
