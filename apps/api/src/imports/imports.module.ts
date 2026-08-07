import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { DoorsModule } from '../doors/doors.module';
import { EmployeesModule } from '../employees/employees.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { PdfParserService } from './pdf-parser.service';
import { PreviewStore } from './preview-store.service';

@Module({
  imports: [AttendanceModule, EmployeesModule, DoorsModule],
  controllers: [ImportsController],
  providers: [ImportsService, PdfParserService, PreviewStore],
  exports: [PdfParserService],
})
export class ImportsModule {}
