import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserSyncService } from './user-sync.service';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UserSyncService],
  exports: [UsersService],
})
export class UsersModule {}
