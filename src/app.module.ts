import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenantModule } from './contexts/tenant/tenant.module';
import { ContractModule } from './contexts/contract/contract.module';
import { BillingModule } from './contexts/invoice/billing.module';

@Module({
  imports: [TenantModule, ContractModule, BillingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
