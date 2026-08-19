import { Module } from '@nestjs/common';
import { SystemController } from './system.controller';
import { SystemMetricsService } from './system-metrics.service';

@Module({
  controllers: [SystemController],
  providers: [SystemMetricsService],
})
export class SystemModule {}
