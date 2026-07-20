import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { UnitType } from './domain/property-unit.entity';
import { PropertyService } from './property.service';
import type { PaginatedPropertiesView } from './property.service';
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
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { PaginatedPropertiesResponseDto, PropertyResponseDto } from './property-response.dto';
import {
  ApiConflictProblem,
  ApiNotFoundProblem,
  ApiProtected,
  ApiUnprocessableProblem,
} from '../../core/infrastructure/http/openapi.decorators';

export class CreatePropertyDto {
  @ApiPropertyOptional({
    minLength: 1,
    maxLength: 120,
    example: 'Centro',
    description:
      'Obrigatório para unidade sem prédio. Quando buildingId é informado, o bairro é derivado do prédio e este valor é ignorado.',
  })
  @ValidateIf((dto: CreatePropertyDto) => !dto.buildingId)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  neighborhood?: string;

  @ApiProperty({ enum: UnitType, enumName: 'UnitType' })
  @IsEnum(UnitType)
  type!: UnitType;

  @ApiProperty({ minLength: 1, maxLength: 40, example: '101-A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  unitNumber!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  buildingId?: string;
}

export class UpdatePropertyDto extends PartialType(
  OmitType(CreatePropertyDto, ['buildingId'] as const),
) {
  @ApiPropertyOptional({
    minLength: 1,
    maxLength: 120,
    example: 'Centro',
    description:
      'Editável apenas para unidade avulsa. Em unidade vinculada, o bairro é derivado do prédio e alterações retornam 422; buildingId é imutável.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  neighborhood?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Campo imutável; presente apenas para explicitar a rejeição de alterações.',
  })
  @IsOptional()
  @IsUUID('4')
  buildingId?: string;
}

export class PropertyPaginationDto {
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

  @ApiPropertyOptional({
    maxLength: 120,
    description: 'Busca parcial por bairro ou número da unidade.',
    example: 'Centro',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ enum: UnitType, enumName: 'UnitType' })
  @IsOptional()
  @IsEnum(UnitType)
  type?: UnitType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  buildingId?: string;
}

export class AvailablePropertiesQueryDto {
  @ApiPropertyOptional({ type: String, format: 'date', description: 'Padrão: data civil atual.' })
  @IsOptional()
  @IsDateString({ strict: true })
  date?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  neighborhood?: string;

  @ApiPropertyOptional({ enum: UnitType, enumName: 'UnitType' })
  @IsOptional()
  @IsEnum(UnitType)
  type?: UnitType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  buildingId?: string;
}

@ApiProtected()
@ApiTags('Imóveis')
@Controller('properties')
export class PropertyController {
  constructor(private readonly service: PropertyService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Cadastrar imóvel' })
  @ApiCreatedResponse({ type: PropertyResponseDto })
  @ApiConflictProblem('Já existe uma unidade com este número no mesmo prédio ou bairro.')
  @ApiUnprocessableProblem()
  async create(@Body() dto: CreatePropertyDto): Promise<PropertyResponseDto> {
    const property = await this.service.create(dto);
    return this.service.getById(property.id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Editar imóvel' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PropertyResponseDto })
  @ApiNotFoundProblem('Unidade imobiliária não encontrada.')
  @ApiConflictProblem('Já existe uma unidade com este número no mesmo prédio ou bairro.')
  @ApiUnprocessableProblem()
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdatePropertyDto,
  ): Promise<PropertyResponseDto> {
    await this.service.update(id, dto);
    return this.service.getById(id);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Listar imóveis' })
  @ApiOkResponse({ type: PaginatedPropertiesResponseDto })
  list(@Query() query: PropertyPaginationDto): Promise<PaginatedPropertiesView> {
    return this.service.list(query);
  }

  @Get('available')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Listar unidades disponíveis em uma data' })
  @ApiOkResponse({ type: [PropertyResponseDto] })
  listAvailable(@Query() query: AvailablePropertiesQueryDto): Promise<PropertyResponseDto[]> {
    return this.service.listAvailable(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Consultar imóvel' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PropertyResponseDto })
  @ApiNotFoundProblem('Unidade imobiliária não encontrada.')
  async get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PropertyResponseDto> {
    return this.service.getById(id);
  }
}
