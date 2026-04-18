import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenantModule } from './contexts/tenant/tenant.module';
import { ContractModule } from './contexts/contract/contract.module';
import { BillingModule } from './contexts/invoice/billing.module';
import { TenantController } from './contexts/tenant/infrastructure/http/controllers/tenant.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    TenantModule,
    ContractModule,
    BillingModule,
  ],
  controllers: [AppController, TenantController],
  providers: [AppService],
})
export class AppModule {}
