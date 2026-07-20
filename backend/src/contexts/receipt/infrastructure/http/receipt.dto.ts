import { ApiProperty } from '@nestjs/swagger';
import { Receipt } from '../../domain/receipt.entity';

export class ReceiptResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ type: Number, format: 'int64', minimum: 1 })
  number!: number;
  @ApiProperty({ format: 'uuid' })
  paymentTransactionId!: string;
  @ApiProperty({ format: 'uuid' })
  invoiceId!: string;
  @ApiProperty({ format: 'uuid' })
  contractId!: string;
  @ApiProperty({ format: 'uuid' })
  tenantId!: string;
  @ApiProperty({ maxLength: 120 })
  tenantName!: string;
  @ApiProperty({ example: '52998224725' })
  tenantCpf!: string;
  @ApiProperty({ format: 'uuid' })
  propertyUnitId!: string;
  @ApiProperty({ maxLength: 300 })
  propertyDescription!: string;
  @ApiProperty({ type: String, format: 'date' })
  periodStart!: string;
  @ApiProperty({ type: String, format: 'date' })
  periodEnd!: string;
  @ApiProperty({ minimum: 1 })
  amountCents!: number;
  @ApiProperty({ maxLength: 30 })
  paymentMethod!: string;
  @ApiProperty({ format: 'date-time' })
  issuedAt!: Date;
  @ApiProperty({ type: String, maxLength: 500, nullable: true })
  voidedReason!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  voidedAt!: Date | null;

  static from(receipt: Receipt): ReceiptResponseDto {
    return {
      id: receipt.id,
      number: receipt.number,
      paymentTransactionId: receipt.paymentTransactionId,
      invoiceId: receipt.invoiceId,
      contractId: receipt.contractId,
      tenantId: receipt.tenantId,
      tenantName: receipt.tenantName,
      tenantCpf: receipt.tenantCpf,
      propertyUnitId: receipt.propertyUnitId,
      propertyDescription: receipt.propertyDescription,
      periodStart: receipt.periodStart,
      periodEnd: receipt.periodEnd,
      amountCents: receipt.amountCents,
      paymentMethod: receipt.paymentMethod,
      issuedAt: receipt.issuedAt,
      voidedReason: receipt.voidedReason,
      voidedAt: receipt.voidedAt,
    };
  }
}

export class ReceiptDownloadUrlDto {
  @ApiProperty({ format: 'uri' })
  url!: string;
  @ApiProperty({ minimum: 1, maximum: 900 })
  expiresInSeconds!: number;
}
