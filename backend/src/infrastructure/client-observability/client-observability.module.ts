import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../../core/infrastructure/audit/audit-log.entity';
import { ClientObservabilityController } from './client-observability.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [ClientObservabilityController],
})
export class ClientObservabilityModule {}
