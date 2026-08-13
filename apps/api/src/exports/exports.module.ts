import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { MailModule } from '../mail/mail.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({
  imports: [AttendanceModule, MailModule],
  controllers: [ExportsController],
  providers: [ExportsService],
})
export class ExportsModule {}
