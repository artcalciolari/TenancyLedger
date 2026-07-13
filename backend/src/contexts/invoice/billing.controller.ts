import {
  Body,
  Controller,
  createParamDecorator,
  ExecutionContext,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
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
import type { PaginatedInvoicesView } from './billing.service';
import { Invoice, InvoiceStatus } from './domain/entities/invoice.entity';
import { PaymentMethod, ProofType } from './domain/entities/payment-transaction.entity';
import {
  InvoiceResponseDto,
  PaginatedInvoicesResponseDto,
  PaymentProofUrlResponseDto,
} from './billing-response.dto';
import {
  ApiConflictProblem,
  ApiNotFoundProblem,
  ApiProtected,
  ApiUnprocessableProblem,
} from '../../core/infrastructure/http/openapi.decorators';

const IdempotencyKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined =>
    context.switchToHttp().getRequest<Request>().header('idempotency-key'),
);

export class InvoicePaginationDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  contractId?: string;

  @ApiPropertyOptional({ pattern: '^\\d{4}-(0[1-9]|1[0-2])$', example: '2026-07' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  competence?: string;

  @ApiPropertyOptional({ enum: InvoiceStatus, enumName: 'InvoiceStatus' })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;
}

export class SubmitPaymentDto {
  @ApiProperty({ minimum: 1, maximum: Invoice.MAX_MONEY_CENTS, example: 50000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(Invoice.MAX_MONEY_CENTS)
  amountCents!: number;

  @ApiProperty({
    enum: PaymentMethod,
    enumName: 'PaymentMethod',
    description: 'PIX e BANK_TRANSFER exigem comprovante; CASH não aceita comprovante digital.',
  })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiPropertyOptional({
    enum: ProofType,
    enumName: 'ProofType',
    description: 'Obrigatório para PIX e BANK_TRANSFER; deve ser omitido para CASH.',
  })
  @IsOptional()
  @IsEnum(ProofType)
  proofType?: ProofType;
}

export class SubmitPaymentMultipartDto extends SubmitPaymentDto {
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Obrigatório para PIX e transferência. PDF, JPEG, PNG ou WebP; até 10 MiB.',
  })
  proof?: string;
}

export class RejectPaymentDto {
  @ApiProperty({ minLength: 1, maxLength: 500, example: 'Comprovante ilegível.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

@ApiProtected()
@ApiTags('Faturas e pagamentos')
@Controller('invoices')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Listar faturas' })
  @ApiOkResponse({ type: PaginatedInvoicesResponseDto })
  list(@Query() query: InvoicePaginationDto): Promise<PaginatedInvoicesView> {
    return this.billingService.list(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Consultar fatura e seus pagamentos' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: InvoiceResponseDto })
  @ApiNotFoundProblem('Fatura não encontrada.')
  async get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<InvoiceResponseDto> {
    return BillingService.toView(await this.billingService.getById(id));
  }

  @Post(':id/payments')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Chave opaca e única por fatura (8 a 128 caracteres ASCII visíveis).',
    schema: {
      type: 'string',
      minLength: 8,
      maxLength: 128,
      pattern: '^[\\x21-\\x7e]{8,128}$',
    },
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: SubmitPaymentMultipartDto,
    description: 'Comprovante obrigatório para PIX/transferência e proibido para dinheiro.',
  })
  @ApiOperation({ summary: 'Submeter pagamento para revisão' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: InvoiceResponseDto })
  @ApiNotFoundProblem('Fatura não encontrada.')
  @ApiConflictProblem('Chave de idempotência reutilizada ou estado conflitante da fatura.')
  @ApiUnprocessableProblem()
  @UseInterceptors(
    FileInterceptor('proof', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 10 },
    }),
  )
  async submitPayment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SubmitPaymentDto,
    @UploadedFile() proof?: Express.Multer.File,
    @IdempotencyKey() idempotencyKey?: string,
  ): Promise<InvoiceResponseDto> {
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
  @ApiOperation({ summary: 'Gerar URL temporária de um comprovante' })
  @ApiParam({ name: 'invoiceId', format: 'uuid' })
  @ApiParam({ name: 'paymentId', format: 'uuid' })
  @ApiOkResponse({ type: PaymentProofUrlResponseDto })
  @ApiNotFoundProblem('Fatura, pagamento ou comprovante não encontrado.')
  getPaymentProof(
    @Param('invoiceId', new ParseUUIDPipe({ version: '4' })) invoiceId: string,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' })) paymentId: string,
  ): Promise<PaymentProofUrlResponseDto> {
    return this.billingService.getPaymentProofUrl(invoiceId, paymentId);
  }

  @Patch(':invoiceId/payments/:paymentId/approve')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Aprovar pagamento submetido' })
  @ApiParam({ name: 'invoiceId', format: 'uuid' })
  @ApiParam({ name: 'paymentId', format: 'uuid' })
  @ApiOkResponse({ type: InvoiceResponseDto })
  @ApiNotFoundProblem('Fatura não encontrada.')
  @ApiConflictProblem('Pagamento já revisado ou aprovação inválida.')
  async approvePayment(
    @Param('invoiceId', new ParseUUIDPipe({ version: '4' })) invoiceId: string,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' })) paymentId: string,
  ): Promise<InvoiceResponseDto> {
    return BillingService.toView(await this.billingService.approvePayment(invoiceId, paymentId));
  }

  @Patch(':invoiceId/payments/:paymentId/reject')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Rejeitar pagamento submetido' })
  @ApiParam({ name: 'invoiceId', format: 'uuid' })
  @ApiParam({ name: 'paymentId', format: 'uuid' })
  @ApiOkResponse({ type: InvoiceResponseDto })
  @ApiNotFoundProblem('Fatura não encontrada.')
  @ApiConflictProblem('Pagamento já revisado ou rejeição inválida.')
  @ApiUnprocessableProblem()
  async rejectPayment(
    @Param('invoiceId', new ParseUUIDPipe({ version: '4' })) invoiceId: string,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' })) paymentId: string,
    @Body() dto: RejectPaymentDto,
  ): Promise<InvoiceResponseDto> {
    return BillingService.toView(
      await this.billingService.rejectPayment(invoiceId, paymentId, dto.reason),
    );
  }
}
