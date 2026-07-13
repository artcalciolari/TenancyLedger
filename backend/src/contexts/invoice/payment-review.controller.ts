import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiOkResponse, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../auth/domain/entities/user.entity';
import { Roles } from '../auth/infrastructure/security/roles.decorator';
import { ApiProtected } from '../../core/infrastructure/http/openapi.decorators';
import { BillingService, PaginatedPaymentReviewView } from './billing.service';
import { PaymentMethod } from './domain/entities/payment-transaction.entity';
import { PaginatedPaymentReviewResponseDto } from './billing-response.dto';

export class PaymentReviewPaginationDto {
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

  @ApiPropertyOptional({ enum: PaymentMethod, enumName: 'PaymentMethod' })
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @ApiPropertyOptional({ pattern: '^\\d{4}-(0[1-9]|1[0-2])$', example: '2026-07' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  competence?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  tenantId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  propertyUnitId?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  submittedFrom?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  submittedTo?: string;

  @ApiPropertyOptional({
    maxLength: 120,
    description: 'Busca por fatura, contrato, locatário, CPF, bairro ou unidade.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

@ApiProtected()
@ApiTags('Faturas e pagamentos')
@Controller('payments')
export class PaymentReviewController {
  constructor(private readonly billingService: BillingService) {}

  @Get('review')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Listar pagamentos submetidos aguardando revisão' })
  @ApiOkResponse({ type: PaginatedPaymentReviewResponseDto })
  list(@Query() query: PaymentReviewPaginationDto): Promise<PaginatedPaymentReviewView> {
    return this.billingService.listPaymentsForReview(query);
  }
}
