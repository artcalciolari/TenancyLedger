import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  IsString,
  MaxLength,
  Max,
  Min,
} from 'class-validator';
import { Contract, ContractStatus } from './domain/entities/contract.entity';
import { ContractService } from './contract.service';
import type { PaginatedContractsView } from './contract.service';
import { UserRole } from '../auth/domain/entities/user.entity';
import { Roles } from '../auth/infrastructure/security/roles.decorator';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  ApiProduces,
} from '@nestjs/swagger';
import { ContractResponseDto, PaginatedContractsResponseDto } from './contract-response.dto';
import {
  ApiConflictProblem,
  ApiNotFoundProblem,
  ApiProtected,
  ApiUnprocessableProblem,
} from '../../core/infrastructure/http/openapi.decorators';

export class CreateContractDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  propertyUnitId!: string;

  @ApiProperty({ type: String, format: 'date', example: '2026-07-01' })
  @IsDateString({ strict: true })
  moveInDate!: string;

  @ApiProperty({ minimum: 1, maximum: Contract.MAX_MONEY_CENTS, example: 150000 })
  @IsInt()
  @Min(1)
  @Max(Contract.MAX_MONEY_CENTS)
  monthlyBaseValueCents!: number;

  @ApiProperty({ minimum: 1, maximum: 600, example: 12 })
  @IsInt()
  @Min(1)
  @Max(600)
  durationInMonths!: number;

  @ApiProperty()
  @IsBoolean()
  isRenewable!: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 28, example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  billingDay?: number;
}

export class ContractPaginationDto {
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

  @ApiPropertyOptional({ enum: ContractStatus, enumName: 'ContractStatus' })
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  tenantId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  propertyUnitId?: string;

  @ApiPropertyOptional({
    maxLength: 120,
    description: 'Busca por contrato, locatário, CPF, e-mail, bairro ou unidade.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  moveInFrom?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  moveInTo?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  endFrom?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  endTo?: string;
}

export class RenewContractDto {
  @ApiProperty({ minimum: 1, maximum: 600, example: 12 })
  @IsInt()
  @Min(1)
  @Max(600)
  extraMonths!: number;
}

@ApiProtected()
@ApiTags('Contratos')
@Controller('contracts')
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Criar contrato' })
  @ApiCreatedResponse({ type: ContractResponseDto })
  @ApiNotFoundProblem('Locatário ou imóvel não encontrado.')
  @ApiConflictProblem('A unidade possui contrato com vigência sobreposta.')
  @ApiUnprocessableProblem()
  async create(@Body() dto: CreateContractDto): Promise<ContractResponseDto> {
    return this.contractService.toDetailedView(await this.contractService.create(dto));
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Listar contratos' })
  @ApiOkResponse({ type: PaginatedContractsResponseDto })
  list(@Query() query: ContractPaginationDto): Promise<PaginatedContractsView> {
    return this.contractService.list(query);
  }

  @Get('export.csv')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Exportar contratos filtrados em CSV' })
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'Arquivo CSV UTF-8 com os contratos que atendem aos filtros.',
    schema: { type: 'string', format: 'binary' },
  })
  async exportCsv(@Query() query: ContractPaginationDto): Promise<StreamableFile> {
    const csv = await this.contractService.exportCsv(query);
    return new StreamableFile(Buffer.from(`\uFEFF${csv}`, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: 'attachment; filename="contracts.csv"',
    });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Consultar contrato' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ContractResponseDto })
  @ApiNotFoundProblem('Contrato não encontrado.')
  async get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ContractResponseDto> {
    return this.contractService.toDetailedView(await this.contractService.getById(id));
  }

  @Patch(':id/renew')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Renovar contrato' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ContractResponseDto })
  @ApiNotFoundProblem('Contrato não encontrado.')
  @ApiConflictProblem('Contrato não renovável ou renovação sobreposta.')
  @ApiUnprocessableProblem()
  async renew(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RenewContractDto,
  ): Promise<ContractResponseDto> {
    return this.contractService.toDetailedView(
      await this.contractService.renew(id, dto.extraMonths),
    );
  }
}
