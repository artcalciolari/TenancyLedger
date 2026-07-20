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
  StreamableFile,
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
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Type } from 'class-transformer';
import {
  IsDateString,
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
import { CurrentUser } from '../auth/infrastructure/security/current-user.decorator';
import type { AuthenticatedUser } from '../auth/application/auth.service';
import { BillingService } from './billing.service';
import type { PaginatedInvoicesView } from './billing.service';
import { Invoice, InvoiceStatus } from './domain/entities/invoice.entity';
import {
  PaymentMethod,
  PaymentStatus,
  ProofType,
} from './domain/entities/payment-transaction.entity';
import {
  IdempotentPaymentLookupResponseDto,
  InvoiceResponseDto,
  PaginatedInvoicesResponseDto,
  PaymentProofUrlResponseDto,
  CashSettlementResponseDto,
} from './billing-response.dto';
import {
  ApiConflictProblem,
  ApiNotFoundProblem,
  ApiProtected,
  ApiUnprocessableProblem,
} from '../../core/infrastructure/http/openapi.decorators';
import { ReceiptService } from '../receipt/application/receipt.service';

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

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  tenantId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  propertyUnitId?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  dueFrom?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  dueTo?: string;

  @ApiPropertyOptional({ enum: PaymentStatus, enumName: 'PaymentStatus' })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ enum: PaymentMethod, enumName: 'PaymentMethod' })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    maxLength: 120,
    description: 'Busca por fatura, contrato, locatário, CPF, e-mail, bairro ou unidade.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
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

export class SettleCashDto {
  @ApiProperty({ minimum: 1, maximum: Invoice.MAX_MONEY_CENTS, example: 150000 })
  @IsInt()
  @Min(1)
  @Max(Invoice.MAX_MONEY_CENTS)
  amountCents!: number;
}

export class ReversePaymentDto {
  @ApiProperty({ minLength: 1, maxLength: 500, example: 'Lançamento em caixa incorreto.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

@ApiProtected()
@ApiTags('Faturas e pagamentos')
@Controller('invoices')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly receiptService: ReceiptService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Listar faturas' })
  @ApiOkResponse({ type: PaginatedInvoicesResponseDto })
  list(@Query() query: InvoicePaginationDto): Promise<PaginatedInvoicesView> {
    return this.billingService.list(query);
  }

  @Get('export.csv')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Exportar faturas filtradas em CSV' })
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'Arquivo CSV UTF-8 com as faturas que atendem aos filtros.',
    schema: { type: 'string', format: 'binary' },
  })
  async exportCsv(@Query() query: InvoicePaginationDto): Promise<StreamableFile> {
    const csv = await this.billingService.exportCsv(query);
    return new StreamableFile(Buffer.from(`\uFEFF${csv}`, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: 'attachment; filename="invoices.csv"',
    });
  }

  @Get(':id/payments/by-idempotency-key')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Recuperar o resultado de uma submissão idempotente' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', minLength: 8, maxLength: 128 },
  })
  @ApiOkResponse({ type: IdempotentPaymentLookupResponseDto })
  @ApiNotFoundProblem('Fatura ou pagamento não encontrado para a chave informada.')
  async getPaymentByIdempotencyKey(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @IdempotencyKey() idempotencyKey?: string,
  ): Promise<IdempotentPaymentLookupResponseDto> {
    const result = await this.billingService.getPaymentByIdempotencyKey(
      id,
      idempotencyKey,
      actor.id,
      actor.role === UserRole.ADMIN,
    );
    return {
      invoice: await this.billingService.toDetailedView(result.invoice),
      payment: BillingService.paymentToView(result.payment),
    };
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
    return this.billingService.toDetailedView(await this.billingService.getById(id));
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
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SubmitPaymentDto,
    @UploadedFile() proof?: Express.Multer.File,
    @IdempotencyKey() idempotencyKey?: string,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.billingService.submitPayment(id, {
      ...dto,
      submittedByUserId: actor.id,
      idempotencyKey,
      proofType: dto.proofType ?? null,
      proof: proof
        ? {
            originalName: proof.originalname,
            contentType: proof.mimetype,
            body: proof.buffer,
          }
        : undefined,
    });
    return this.billingService.toDetailedView(invoice);
  }

  @Post(':id/settle-cash')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', minLength: 8, maxLength: 128 },
  })
  @ApiOperation({ summary: 'Registrar pagamento em dinheiro com aprovação direta' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: CashSettlementResponseDto })
  @ApiNotFoundProblem('Fatura não encontrada.')
  @ApiConflictProblem('Chave de idempotência reutilizada ou saldo insuficiente.')
  @ApiUnprocessableProblem()
  async settleCash(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SettleCashDto,
    @IdempotencyKey() idempotencyKey?: string,
  ): Promise<CashSettlementResponseDto> {
    const invoice = await this.billingService.settleCash(id, {
      ...dto,
      idempotencyKey,
      settledByUserId: actor.id,
    });
    const payment = invoice.findPaymentByIdempotencyKey(idempotencyKey as string);
    const receipt = await this.receiptService.getByPayment(payment?.id ?? '');
    return {
      invoice: await this.billingService.toDetailedView(invoice),
      receiptId: receipt.id,
    };
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
    @CurrentUser() actor: AuthenticatedUser,
    @Param('invoiceId', new ParseUUIDPipe({ version: '4' })) invoiceId: string,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' })) paymentId: string,
  ): Promise<InvoiceResponseDto> {
    return this.billingService.toDetailedView(
      await this.billingService.approvePayment(invoiceId, paymentId, actor.id),
    );
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
    @CurrentUser() actor: AuthenticatedUser,
    @Param('invoiceId', new ParseUUIDPipe({ version: '4' })) invoiceId: string,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' })) paymentId: string,
    @Body() dto: RejectPaymentDto,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.billingService.rejectPayment(
      invoiceId,
      paymentId,
      dto.reason,
      actor.id,
    );
    return this.billingService.toDetailedView(invoice);
  }

  @Patch(':invoiceId/payments/:paymentId/reverse')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Estornar pagamento aprovado sem apagar o lançamento' })
  @ApiParam({ name: 'invoiceId', format: 'uuid' })
  @ApiParam({ name: 'paymentId', format: 'uuid' })
  @ApiOkResponse({ type: InvoiceResponseDto })
  @ApiNotFoundProblem('Fatura não encontrada.')
  @ApiConflictProblem('Somente pagamentos aprovados podem ser estornados.')
  @ApiUnprocessableProblem()
  async reversePayment(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('invoiceId', new ParseUUIDPipe({ version: '4' })) invoiceId: string,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' })) paymentId: string,
    @Body() dto: ReversePaymentDto,
  ): Promise<InvoiceResponseDto> {
    return this.billingService.toDetailedView(
      await this.billingService.reversePayment(invoiceId, paymentId, dto.reason, actor.id),
    );
  }
}
