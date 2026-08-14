import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Body,
} from '@nestjs/common';
import { doorUpdateSchema, type DoorUpdateInput, type SessionUser } from '@ttah/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuditService } from '../audit/audit.service';
import { DoorsService } from './doors.service';

@Controller('doors')
export class DoorsController {
  constructor(
    private readonly doors: DoorsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list() {
    return this.doors.list();
  }

  @Get('zones')
  zones() {
    return this.doors.zones();
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(doorUpdateSchema)) body: DoorUpdateInput,
  ) {
    return this.doors.update(id, body);
  }

  @Delete('invalid')
  async purgeInvalid(@CurrentUser() user: SessionUser) {
    const result = await this.doors.purgeInvalid();
    await this.audit.log({
      userId: user.id,
      action: 'purge-invalid',
      entity: 'Door',
      after: result,
    });
    return result;
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser) {
    const result = await this.doors.remove(id);
    await this.audit.log({
      userId: user.id,
      action: 'delete',
      entity: 'Door',
      entityId: id,
      after: result,
    });
    return result;
  }
}
