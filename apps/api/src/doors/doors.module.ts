import { Module } from '@nestjs/common';
import { DoorsService } from './doors.service';
import { DoorsController, OfficesController } from './doors.controller';

@Module({
  controllers: [DoorsController, OfficesController],
  providers: [DoorsService],
  exports: [DoorsService],
})
export class DoorsModule {}
