import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiHeader } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { UserRole } from '../auth/domain/entities/user.entity';
import { Roles } from '../auth/infrastructure/security/roles.decorator';
import { BillingService } from './billing.service';
import type { InvoiceView, PaginatedInvoicesView } from './billing.service';
import { Invoice, InvoiceStatus } from './domain/entities/invoice.entity';
import { PaymentMethod, ProofType } from './domain/entities/payment-transaction.entity';

export class InvoicePaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsUUID('4')
  contractId?: string;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  competence?: string;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;
}

export class SubmitPaymentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(Invoice.MAX_MONEY_CENTS)
  amountCents!: number;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsOptional()
  @IsEnum(ProofType)
  proofType?: ProofType;
}

export class RejectPaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

@Controller('invoices')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  list(@Query() query: InvoicePaginationDto): Promise<PaginatedInvoicesView> {
    return this.billingService.list(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  async get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<InvoiceView> {
    return BillingService.toView(await this.billingService.getById(id));
  }

  @Post(':id/payments')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Chave opaca e única por fatura (8 a 128 caracteres ASCII visíveis).',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('proof', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 10 },
    }),
  )
  async submitPayment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SubmitPaymentDto,
    @UploadedFile() proof?: Express.Multer.File,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<InvoiceView> {
    return BillingService.toView(
      await this.billingService.submitPayment(id, {
        ...dto,
        idempotencyKey,
        proofType: dto.proofType ?? null,
        proof: proof
          ? {
              originalName: proof.originalname,
              contentType: proof.mimetype,
              body: proof.buffer,
            }
          : undefined,
      }),
    );
  }

  @Get(':invoiceId/payments/:paymentId/proof')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  getPaymentProof(
    @Param('invoiceId', new ParseUUIDPipe({ version: '4' })) invoiceId: string,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' })) paymentId: string,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    return this.billingService.getPaymentProofUrl(invoiceId, paymentId);
  }

  @Patch(':invoiceId/payments/:paymentId/approve')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async approvePayment(
    @Param('invoiceId', new ParseUUIDPipe({ version: '4' })) invoiceId: string,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' })) paymentId: string,
  ): Promise<InvoiceView> {
    return BillingService.toView(await this.billingService.approvePayment(invoiceId, paymentId));
  }

  @Patch(':invoiceId/payments/:paymentId/reject')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async rejectPayment(
    @Param('invoiceId', new ParseUUIDPipe({ version: '4' })) invoiceId: string,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' })) paymentId: string,
    @Body() dto: RejectPaymentDto,
  ): Promise<InvoiceView> {
    return BillingService.toView(
      await this.billingService.rejectPayment(invoiceId, paymentId, dto.reason),
    );
  }
}
