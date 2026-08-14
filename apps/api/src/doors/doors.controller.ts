import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Body,
} from '@nestjs/common';
import {
  doorUpdateSchema,
  officeCreateSchema,
  readerUpdateSchema,
  type DoorUpdateInput,
  type OfficeCreateInput,
  type ReaderUpdateInput,
  type SessionUser,
} from '@ttah/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuditService } from '../audit/audit.service';
import { DoorsService } from './doors.service';

@Controller('offices')
export class OfficesController {
  constructor(
    private readonly doors: DoorsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list() {
    return this.doors.listOffices();
  }

  @Post()
  @Roles('admin')
  async create(
    @Body(new ZodValidationPipe(officeCreateSchema)) body: OfficeCreateInput,
    @CurrentUser() user: SessionUser,
  ) {
    const office = await this.doors.createOffice(body.name);
    await this.audit.log({
      userId: user.id,
      action: 'create',
      entity: 'Office',
      entityId: office.id,
      after: office,
    });
    return office;
  }

  @Patch(':id')
  @Roles('admin')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(officeCreateSchema)) body: OfficeCreateInput,
    @CurrentUser() user: SessionUser,
  ) {
    const office = await this.doors.updateOffice(id, body.name);
    await this.audit.log({
      userId: user.id,
      action: 'update',
      entity: 'Office',
      entityId: id,
      after: office,
    });
    return office;
  }

  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser) {
    const result = await this.doors.removeOffice(id);
    await this.audit.log({
      userId: user.id,
      action: 'delete',
      entity: 'Office',
      entityId: id,
    });
    return result;
  }
}

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

  @Delete('invalid-readers')
  @Roles('admin')
  async purgeInvalid(@CurrentUser() user: SessionUser) {
    const result = await this.doors.purgeInvalid();
    await this.audit.log({
      userId: user.id,
      action: 'purge-invalid',
      entity: 'Reader',
      after: result,
    });
    return result;
  }

  @Patch(':id')
  @Roles('admin')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(doorUpdateSchema)) body: DoorUpdateInput,
    @CurrentUser() user: SessionUser,
  ) {
    const door = await this.doors.updateDoor(id, body);
    await this.audit.log({
      userId: user.id,
      action: 'update',
      entity: 'Door',
      entityId: id,
      after: body,
    });
    return door;
  }

  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser) {
    const result = await this.doors.removeDoor(id);
    await this.audit.log({
      userId: user.id,
      action: 'delete',
      entity: 'Door',
      entityId: id,
      after: result,
    });
    return result;
  }

  @Patch(':doorId/readers/:readerId')
  @Roles('admin')
  async updateReader(
    @Param('readerId', ParseIntPipe) readerId: number,
    @Body(new ZodValidationPipe(readerUpdateSchema)) body: ReaderUpdateInput,
    @CurrentUser() user: SessionUser,
  ) {
    const reader = await this.doors.updateReader(readerId, body);
    await this.audit.log({
      userId: user.id,
      action: 'update',
      entity: 'Reader',
      entityId: readerId,
      after: body,
    });
    return reader;
  }

  @Delete(':doorId/readers/:readerId')
  @Roles('admin')
  async removeReader(
    @Param('readerId', ParseIntPipe) readerId: number,
    @CurrentUser() user: SessionUser,
  ) {
    const result = await this.doors.removeReader(readerId);
    await this.audit.log({
      userId: user.id,
      action: 'delete',
      entity: 'Reader',
      entityId: readerId,
      after: result,
    });
    return result;
  }
}
