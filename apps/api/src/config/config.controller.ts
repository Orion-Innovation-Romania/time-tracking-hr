import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import {
  conditionRuleSchema,
  holidaySchema,
  leaveSchema,
  lunchConfigSchema,
  scheduleConfigSchema,
  thresholdConfigSchema,
  type ConditionRuleInput,
  type HolidayInput,
  type LeaveInput,
  type LunchConfig,
  type ScheduleConfig,
  type SessionUser,
  type ThresholdConfig,
} from '@ttah/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ConfigStoreService } from './config-store.service';

const conditionsSchema = z.array(conditionRuleSchema);
const retentionSchema = z.object({ months: z.number().int().min(1).max(120) });

@Controller('config')
export class ConfigController {
  constructor(private readonly store: ConfigStoreService) {}

  @Get('schedule')
  getSchedule() {
    return this.store.getSchedule();
  }

  @Put('schedule')
  setSchedule(
    @Body(new ZodValidationPipe(scheduleConfigSchema)) body: ScheduleConfig,
    @CurrentUser() user: SessionUser,
  ) {
    return this.store.setSchedule(body, user.id);
  }

  @Get('lunch')
  getLunch() {
    return this.store.getLunch();
  }

  @Put('lunch')
  setLunch(
    @Body(new ZodValidationPipe(lunchConfigSchema)) body: LunchConfig,
    @CurrentUser() user: SessionUser,
  ) {
    return this.store.setLunch(body, user.id);
  }

  @Get('thresholds')
  getThresholds() {
    return this.store.getThresholds();
  }

  @Put('thresholds')
  setThresholds(
    @Body(new ZodValidationPipe(thresholdConfigSchema)) body: ThresholdConfig,
    @CurrentUser() user: SessionUser,
  ) {
    return this.store.setThresholds(body, user.id);
  }

  @Get('retention')
  async getRetention() {
    return { months: await this.store.getRetentionMonths() };
  }

  @Put('retention')
  setRetention(
    @Body(new ZodValidationPipe(retentionSchema)) body: { months: number },
    @CurrentUser() user: SessionUser,
  ) {
    return this.store.setRetentionMonths(body.months, user.id);
  }

  @Get('conditions')
  getConditions() {
    return this.store.getConditions();
  }

  @Put('conditions')
  replaceConditions(
    @Body(new ZodValidationPipe(conditionsSchema)) body: ConditionRuleInput[],
    @CurrentUser() user: SessionUser,
  ) {
    return this.store.replaceConditions(body, user.id);
  }

  @Get('holidays')
  listHolidays(@Query('year') year?: string) {
    return this.store.listHolidays(year ? Number(year) : undefined);
  }

  @Post('holidays')
  upsertHoliday(
    @Body(new ZodValidationPipe(holidaySchema)) body: HolidayInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.store.upsertHoliday(body, user.id);
  }

  @Delete('holidays/:id')
  deleteHoliday(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser) {
    return this.store.deleteHoliday(id, user.id);
  }

  @Get('leaves')
  listLeaves(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.store.listLeaves({
      from,
      to,
      employeeId: employeeId ? Number(employeeId) : undefined,
    });
  }

  @Post('leaves')
  upsertLeave(
    @Body(new ZodValidationPipe(leaveSchema)) body: LeaveInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.store.upsertLeave(body, user.id);
  }

  @Delete('leaves/:id')
  deleteLeave(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser) {
    return this.store.deleteLeave(id, user.id);
  }
}
