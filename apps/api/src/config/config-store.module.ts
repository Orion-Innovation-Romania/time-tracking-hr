import { Module } from '@nestjs/common';
import { ConfigStoreService } from './config-store.service';
import { ConfigController } from './config.controller';

@Module({
  controllers: [ConfigController],
  providers: [ConfigStoreService],
  exports: [ConfigStoreService],
})
export class ConfigStoreModule {}
