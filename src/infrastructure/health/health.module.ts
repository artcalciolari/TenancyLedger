import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { StorageModule } from '../storage.module';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, StorageModule],
  controllers: [HealthController],
})
export class HealthModule {}
