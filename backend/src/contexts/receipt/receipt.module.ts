import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReceiptIssuerService } from './application/receipt-issuer.service';
import { ReceiptService } from './application/receipt.service';
import { Receipt } from './domain/receipt.entity';
import { ReceiptDocumentRenderer } from './infrastructure/receipt-document.renderer';
import { ReceiptController } from './infrastructure/http/receipt.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Receipt])],
  controllers: [ReceiptController],
  providers: [ReceiptService, ReceiptIssuerService, ReceiptDocumentRenderer],
  exports: [ReceiptIssuerService, ReceiptService, TypeOrmModule],
})
export class ReceiptModule {}
