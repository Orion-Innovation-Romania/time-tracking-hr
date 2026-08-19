import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemMetricsService } from './system-metrics.service';

@Controller('system')
@Roles('admin')
export class SystemController {
  constructor(private readonly metrics: SystemMetricsService) {}

  @Get('now')
  now() {
    return this.metrics.now();
  }

  @Get('history')
  history(@Query('hours') hours?: string) {
    return this.metrics.history(Number(hours) || 24);
  }
}
