import { ApiProperty } from '@nestjs/swagger';
import { PageMetaDto } from '../../core/infrastructure/http/openapi.dto';
import { InvoiceStatus } from './domain/entities/invoice.entity';
import {
  PaymentMethod,
  PaymentStatus,
  ProofType,
} from './domain/entities/payment-transaction.entity';

export class PaymentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ minimum: 1, maximum: 2147483647, example: 50000 })
  amountCents!: number;

  @ApiProperty({ format: 'date-time' })
  submittedAt!: Date;

  @ApiProperty({ enum: PaymentMethod, enumName: 'PaymentMethod' })
  method!: PaymentMethod;

  @ApiProperty({
    enum: ProofType,
    enumName: 'ProofType',
    nullable: true,
  })
  proofType!: ProofType | null;

  @ApiProperty()
  hasProof!: boolean;

  @ApiProperty({ enum: PaymentStatus, enumName: 'PaymentStatus' })
  status!: PaymentStatus;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  reviewedAt!: Date | null;

  @ApiProperty({ type: String, maxLength: 500, nullable: true })
  rejectionReason!: string | null;
}

export class InvoiceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  contractId!: string;

  @ApiProperty({ pattern: '^\\d{4}-(0[1-9]|1[0-2])$', example: '2026-07' })
  competence!: string;

  @ApiProperty({ minimum: 1, maximum: 2147483647, example: 150000 })
  totalValueCents!: number;

  @ApiProperty({ minimum: 0, maximum: 2147483647, example: 50000 })
  approvedAmountCents!: number;

  @ApiProperty({ minimum: 0, maximum: 2147483647, example: 100000 })
  outstandingAmountCents!: number;

  @ApiProperty({ type: String, format: 'date', example: '2026-07-10' })
  dueDate!: string;

  @ApiProperty({ enum: InvoiceStatus, enumName: 'InvoiceStatus' })
  status!: InvoiceStatus;

  @ApiProperty({ type: [PaymentResponseDto] })
  payments!: PaymentResponseDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class PaginatedInvoicesResponseDto {
  @ApiProperty({ type: [InvoiceResponseDto] })
  data!: InvoiceResponseDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}

export class PaymentProofUrlResponseDto {
  @ApiProperty({ format: 'uri', description: 'URL assinada e temporária do comprovante.' })
  url!: string;

  @ApiProperty({ minimum: 1, example: 300 })
  expiresInSeconds!: number;
}
