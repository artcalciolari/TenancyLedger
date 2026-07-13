import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractModule } from '../contract/contract.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { Invoice } from './domain/entities/invoice.entity';
import { PaymentTransaction } from './domain/entities/payment-transaction.entity';
import { INVOICE_REPOSITORY_TOKEN } from './domain/invoice.repository';
import { InvoiceTypeOrmRepository } from './infrastructure/invoice.typeorm.repository';
import {
  CLOCK_TOKEN,
  InvoiceGenerationWorker,
  SystemClock,
} from './infrastructure/workers/invoice-generation.worker';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, PaymentTransaction]),
    ScheduleModule.forRoot(),
    ContractModule,
  ],
  controllers: [BillingController],
  providers: [
    BillingService,
    InvoiceGenerationWorker,
    { provide: CLOCK_TOKEN, useClass: SystemClock },
    { provide: INVOICE_REPOSITORY_TOKEN, useClass: InvoiceTypeOrmRepository },
  ],
  exports: [BillingService, INVOICE_REPOSITORY_TOKEN, TypeOrmModule],
})
export class BillingModule {}
