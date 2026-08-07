import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { doorUpdateSchema, type DoorUpdateInput } from '@ttah/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { DoorsService } from './doors.service';

@Controller('doors')
export class DoorsController {
  constructor(private readonly doors: DoorsService) {}

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
}
