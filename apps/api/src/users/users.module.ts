import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserSyncService } from './user-sync.service';
import { UsersFileService } from './users-file.service';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersFileService, UserSyncService],
  exports: [UsersService],
})
export class UsersModule {}
