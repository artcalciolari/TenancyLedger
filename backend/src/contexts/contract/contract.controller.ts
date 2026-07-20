import {
  BadRequestException,
  Body,
  Controller,
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
import { Transform, Type, type TransformFnParams } from 'class-transformer';
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
  ValidateIf,
} from 'class-validator';
import {
  Contract,
  ContractBadge,
  ContractStatus,
  ContractType,
} from './domain/entities/contract.entity';
import { ContractService } from './contract.service';
import type { PaginatedContractsView } from './contract.service';
import { UserRole } from '../auth/domain/entities/user.entity';
import { Roles } from '../auth/infrastructure/security/roles.decorator';
import { CurrentUser } from '../auth/infrastructure/security/current-user.decorator';
import type { AuthenticatedUser } from '../auth/application/auth.service';
import {
  ApiCreatedResponse,
  ApiBody,
  ApiConsumes,
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
import { ContractDocumentsService } from './application/contract-documents.service';
import {
  ContractDocumentDownloadUrlDto,
  ContractDocumentResponseDto,
  UploadContractDocumentDto,
  UploadContractDocumentKind,
  UploadContractDocumentMultipartDto,
} from './contract-document.dto';
import { ContractDocumentKind } from './domain/entities/contract-document.entity';

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

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 600,
    example: 12,
    nullable: true,
    description: 'Obrigatório em FIXED_TERM e omitido em MONTH_TO_MONTH.',
  })
  @ValidateIf((dto: CreateContractDto) => dto.contractType !== ContractType.MONTH_TO_MONTH)
  @IsInt()
  @Min(1)
  @Max(600)
  durationInMonths?: number | null;

  @ApiProperty()
  @IsBoolean()
  isRenewable!: boolean;

  @ApiPropertyOptional({
    enum: ContractType,
    enumName: 'ContractType',
    default: ContractType.FIXED_TERM,
  })
  @IsOptional()
  @IsEnum(ContractType)
  contractType: ContractType = ContractType.FIXED_TERM;

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

  @ApiPropertyOptional({ enum: ContractBadge, enumName: 'ContractBadge' })
  @IsOptional()
  @IsEnum(ContractBadge)
  badge?: ContractBadge;

  @ApiPropertyOptional({
    description:
      'Quando verdadeiro, filtra a união de contratos com renovação próxima (RENEWAL_DUE) ou pagamento em atraso (PAYMENT_OVERDUE).',
  })
  @IsOptional()
  @Transform(({ value }: TransformFnParams): unknown => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value as unknown;
  })
  @IsBoolean()
  renewalAttention?: boolean;

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

export class ContractTransitionReasonDto {
  @ApiProperty({ minLength: 1, maxLength: 500 })
  @IsString()
  @MaxLength(500)
  reason!: string;
}

@ApiProtected()
@ApiTags('Contratos')
@Controller('contracts')
export class ContractController {
  constructor(
    private readonly contractService: ContractService,
    private readonly contractDocuments: ContractDocumentsService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Criar contrato' })
  @ApiCreatedResponse({ type: ContractResponseDto })
  @ApiNotFoundProblem('Locatário ou imóvel não encontrado.')
  @ApiConflictProblem('A unidade possui contrato com vigência sobreposta.')
  @ApiUnprocessableProblem()
  async create(
    @Body() dto: CreateContractDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ContractResponseDto> {
    return this.contractService.toDetailedView(await this.contractService.create(dto), user.role);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Listar contratos' })
  @ApiOkResponse({ type: PaginatedContractsResponseDto })
  list(
    @Query() query: ContractPaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedContractsView> {
    return this.contractService.list(query, user.role);
  }

  @Get('export.csv')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Exportar contratos filtrados em CSV' })
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'Arquivo CSV UTF-8 com os contratos que atendem aos filtros.',
    schema: { type: 'string', format: 'binary' },
  })
  async exportCsv(
    @Query() query: ContractPaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StreamableFile> {
    const csv = await this.contractService.exportCsv(query, user.role);
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
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ContractResponseDto> {
    return this.contractService.toDetailedView(await this.contractService.getById(id), user.role);
  }

  @Get(':id/document/preview')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Gerar prévia PDF do contrato mensal' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    description: 'Prévia do contrato em PDF.',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiNotFoundProblem('Contrato ou relacionamentos não encontrados.')
  @ApiConflictProblem('A prévia mensal exige um contrato MONTH_TO_MONTH.')
  async previewDocument(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<StreamableFile> {
    return new StreamableFile(await this.contractDocuments.preview(id), {
      type: 'application/pdf',
      disposition: `inline; filename="contract-${id}.pdf"`,
    });
  }

  @Post(':id/documents/generate')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Gerar e armazenar uma nova versão do contrato para impressão' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: ContractDocumentResponseDto })
  @ApiNotFoundProblem('Contrato ou relacionamentos não encontrados.')
  @ApiConflictProblem(
    'A geração de contrato está disponível apenas para contratos mensais pendentes de assinatura.',
  )
  async generateDocument(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ContractDocumentResponseDto> {
    return this.contractDocuments.generate(id, user.id);
  }

  @Post(':id/documents')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Enviar documento assinado ou complementar do contrato' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadContractDocumentMultipartDto })
  @ApiCreatedResponse({ type: ContractDocumentResponseDto })
  @ApiNotFoundProblem('Contrato não encontrado.')
  @ApiUnprocessableProblem()
  @UseInterceptors(
    FileInterceptor('document', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5 },
    }),
  )
  async uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UploadContractDocumentDto,
    @UploadedFile() document?: Express.Multer.File,
  ): Promise<ContractDocumentResponseDto> {
    if (!document) throw new BadRequestException('O documento do contrato é obrigatório.');
    return this.contractDocuments.upload(id, {
      kind:
        dto.kind === UploadContractDocumentKind.SIGNED
          ? ContractDocumentKind.SIGNED
          : ContractDocumentKind.OTHER,
      originalName: document.originalname,
      contentType: document.mimetype,
      body: document.buffer,
      uploadedByUserId: user.id,
    });
  }

  @Get(':id/documents')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Listar o histórico de documentos do contrato' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: [ContractDocumentResponseDto] })
  @ApiNotFoundProblem('Contrato não encontrado.')
  listDocuments(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ContractDocumentResponseDto[]> {
    return this.contractDocuments.list(id);
  }

  @Get(':contractId/documents/:documentId/download')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Gerar URL temporária para baixar documento do contrato' })
  @ApiParam({ name: 'contractId', format: 'uuid' })
  @ApiParam({ name: 'documentId', format: 'uuid' })
  @ApiOkResponse({ type: ContractDocumentDownloadUrlDto })
  @ApiNotFoundProblem('Documento do contrato não encontrado.')
  downloadDocument(
    @Param('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' })) documentId: string,
  ): Promise<ContractDocumentDownloadUrlDto> {
    return this.contractDocuments.getDownloadUrl(contractId, documentId);
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
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ContractResponseDto> {
    return this.contractService.toDetailedView(
      await this.contractService.renew(id, dto.extraMonths),
      user.role,
    );
  }

  @Patch(':id/mark-signed')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Registrar assinatura do contrato' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ContractResponseDto })
  @ApiNotFoundProblem('Contrato não encontrado.')
  @ApiConflictProblem('Transição de status inválida.')
  async markSigned(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ContractResponseDto> {
    return this.contractService.toDetailedView(
      await this.contractService.markSigned(id),
      user.role,
    );
  }

  @Patch(':id/activate')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Ativar contrato com pagamento inicial confirmado' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ContractResponseDto })
  @ApiNotFoundProblem('Contrato não encontrado.')
  @ApiConflictProblem('Transição de status inválida.')
  async activate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ContractResponseDto> {
    return this.contractService.toDetailedView(await this.contractService.activate(id), user.role);
  }

  @Patch(':id/schedule-ending')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Programar encerramento do contrato' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ContractResponseDto })
  @ApiNotFoundProblem('Contrato não encontrado.')
  @ApiConflictProblem('Transição de status inválida.')
  @ApiUnprocessableProblem()
  async scheduleEnding(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ContractTransitionReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ContractResponseDto> {
    return this.contractService.toDetailedView(
      await this.contractService.scheduleEnding(id, dto.reason),
      user.role,
    );
  }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Cancelar contrato ainda não ativo' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ContractResponseDto })
  @ApiNotFoundProblem('Contrato não encontrado.')
  @ApiConflictProblem('Transição de status inválida.')
  @ApiUnprocessableProblem()
  async cancel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ContractTransitionReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ContractResponseDto> {
    return this.contractService.toDetailedView(
      await this.contractService.cancel(id, dto.reason),
      user.role,
    );
  }

  @Patch(':id/terminate')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Encerrar contrato ativo' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ContractResponseDto })
  @ApiNotFoundProblem('Contrato não encontrado.')
  @ApiConflictProblem('Transição de status inválida.')
  @ApiUnprocessableProblem()
  async terminate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ContractTransitionReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ContractResponseDto> {
    return this.contractService.toDetailedView(
      await this.contractService.terminate(id, dto.reason),
      user.role,
    );
  }
}
