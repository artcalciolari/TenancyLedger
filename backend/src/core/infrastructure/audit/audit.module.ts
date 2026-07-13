import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditInterceptor } from './audit.interceptor';
import { HttpExceptionAuditFilter } from './http-exception-audit.filter';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionAuditFilter },
  ],
})
export class AuditModule {}
