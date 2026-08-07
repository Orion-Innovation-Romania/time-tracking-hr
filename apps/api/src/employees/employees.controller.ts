import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { timeString } from '@ttah/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { EmployeesService } from './employees.service';

const updateEmployeeSchema = z.object({
  displayName: z.string().min(1).max(160).optional(),
  active: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
type UpdateEmployee = z.infer<typeof updateEmployeeSchema>;

const scheduleOverrideSchema = z.object({
  startTime: timeString.nullable().optional(),
  endTime: timeString.nullable().optional(),
  workingDays: z.array(z.number().int().min(1).max(7)).nullable().optional(),
});
type ScheduleOverride = z.infer<typeof scheduleOverrideSchema>;

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(@Query('search') search?: string, @Query('includeInactive') includeInactive?: string) {
    return this.employees.list(search, includeInactive === 'true');
  }

  @Get('departments')
  departments() {
    return this.employees.departments();
  }

  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.employees.getById(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateEmployeeSchema)) body: UpdateEmployee,
  ) {
    return this.employees.update(id, body);
  }

  @Get(':id/schedule')
  getSchedule(@Param('id', ParseIntPipe) id: number) {
    return this.employees.getSchedule(id);
  }

  @Put(':id/schedule')
  setSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(scheduleOverrideSchema)) body: ScheduleOverride,
  ) {
    return this.employees.setSchedule(id, body);
  }
}
