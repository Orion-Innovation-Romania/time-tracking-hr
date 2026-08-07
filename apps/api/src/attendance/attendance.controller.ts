import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import {
  attendanceFilterSchema,
  dateString,
  dayCorrectionSchema,
  type AttendanceFilter,
  type DayCorrectionInput,
  type SessionUser,
} from '@ttah/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AttendanceService } from './attendance.service';

const recomputeSchema = z.object({
  from: dateString,
  to: dateString,
  employeeIds: z.array(z.number().int().positive()).optional(),
});
type RecomputeInput = z.infer<typeof recomputeSchema>;

function parseNumberList(value?: string): number[] | undefined {
  if (!value) return undefined;
  const ids = value
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v));
  return ids.length ? ids : undefined;
}

function parseStringList(value?: string): string[] | undefined {
  if (!value) return undefined;
  const items = value.split(',').map((v) => v.trim()).filter(Boolean);
  return items.length ? items : undefined;
}

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('summaries')
  summaries(@Body(new ZodValidationPipe(attendanceFilterSchema)) filter: AttendanceFilter) {
    return this.attendance.getSummaries(filter);
  }

  @Post('dashboard')
  dashboard(@Body(new ZodValidationPipe(attendanceFilterSchema)) filter: AttendanceFilter) {
    return this.attendance.getDashboard(filter);
  }

  @Get('month')
  month(
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('employeeIds') employeeIds?: string,
    @Query('departments') departments?: string,
  ) {
    return this.attendance.getMonthAggregates(Number(year), Number(month), {
      employeeIds: parseNumberList(employeeIds),
      departments: parseStringList(departments),
    });
  }

  @Get('day')
  day(@Query('employeeId') employeeId: string, @Query('date') date: string) {
    return this.attendance.getDayDetail(Number(employeeId), date);
  }

  @Post('recompute')
  recompute(@Body(new ZodValidationPipe(recomputeSchema)) body: RecomputeInput) {
    return this.attendance.recomputeAll(body.from, body.to, body.employeeIds);
  }

  @Get('door-health')
  doorHealth(@Query('from') from: string, @Query('to') to: string) {
    return this.attendance.getDoorHealth(dateString.parse(from), dateString.parse(to));
  }

  @Post('correction')
  correction(
    @Body(new ZodValidationPipe(dayCorrectionSchema)) body: DayCorrectionInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.attendance.applyCorrection(body, user.id);
  }

  @Delete('correction')
  clearCorrection(
    @Query('employeeId') employeeId: string,
    @Query('date') date: string,
    @CurrentUser() user: SessionUser,
  ) {
    return this.attendance.clearCorrection(Number(employeeId), date, user.id);
  }
}
