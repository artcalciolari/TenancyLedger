import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { environmentSchema } from './config/environment';
import { AuthModule } from './contexts/auth/auth.module';
import { ContractModule } from './contexts/contract/contract.module';
import { BillingModule } from './contexts/invoice/billing.module';
import { PropertyModule } from './contexts/property/property.module';
import { TenantModule } from './contexts/tenant/tenant.module';
import { NotificationModule } from './contexts/notification/notification.module';
import { AuditModule } from './core/infrastructure/audit/audit.module';
import { createTypeOrmOptions } from './database/typeorm.options';
import { HealthModule } from './infrastructure/health/health.module';
import { ClientObservabilityModule } from './infrastructure/client-observability/client-observability.module';
import { MetricsModule } from './infrastructure/metrics/metrics.module';
import { StorageModule } from './infrastructure/storage.module';
import { DashboardModule } from './contexts/dashboard/dashboard.module';
import { OnboardingModule } from './contexts/onboarding/onboarding.module';
import { CashboxModule } from './contexts/cashbox/cashbox.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: false,
      validationSchema: environmentSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL', 'info'),
          genReqId: (request, response) => {
            const incoming = request.headers['x-request-id'];
            const requestId =
              typeof incoming === 'string' && /^[a-zA-Z0-9._:-]{1,100}$/.test(incoming)
                ? incoming
                : randomUUID();
            response.setHeader('x-request-id', requestId);
            return requestId;
          },
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.headers.x-metrics-token',
              'req.url',
              'req.query',
              'res.headers.set-cookie',
              'req.body.password',
              'req.body.cpf',
              'req.body.rg',
              'req.body.email',
              'req.body.mobile',
              'req.body.mobilePhone',
              'req.body.proofReference',
            ],
            censor: '[REDACTED]',
          },
        },
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: createTypeOrmOptions,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.getOrThrow<number>('THROTTLE_TTL_MS'),
          limit: config.getOrThrow<number>('THROTTLE_LIMIT'),
        },
      ],
    }),
    MetricsModule,
    AuthModule,
    TenantModule,
    PropertyModule,
    ContractModule,
    BillingModule,
    DashboardModule,
    NotificationModule,
    OnboardingModule,
    CashboxModule,
    StorageModule,
    ClientObservabilityModule,
    AuditModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
