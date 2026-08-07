import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({
  imports: [AttendanceModule],
  controllers: [ExportsController],
  providers: [ExportsService],
})
export class ExportsModule {}
