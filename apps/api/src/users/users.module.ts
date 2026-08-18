import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { UsersService } from './users.service';
import { UserSyncService } from './user-sync.service';
import { UsersFileService } from './users-file.service';
import { UsersController } from './users.controller';

@Module({
  imports: [MailModule],
  controllers: [UsersController],
  providers: [UsersService, UsersFileService, UserSyncService],
  exports: [UsersService],
})
export class UsersModule {}
