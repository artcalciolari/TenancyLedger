import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
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
} from '@nestjs/swagger';
import { PaginatedPropertiesResponseDto, PropertyResponseDto } from './property-response.dto';
import {
  ApiConflictProblem,
  ApiNotFoundProblem,
  ApiProtected,
  ApiUnprocessableProblem,
} from '../../core/infrastructure/http/openapi.decorators';

export class CreatePropertyDto {
  @ApiProperty({ minLength: 1, maxLength: 120, example: 'Centro' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  neighborhood!: string;

  @ApiProperty({ enum: UnitType, enumName: 'UnitType' })
  @IsEnum(UnitType)
  type!: UnitType;

  @ApiProperty({ minLength: 1, maxLength: 40, example: '101-A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  unitNumber!: string;
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
  @ApiConflictProblem('Já existe uma unidade com este bairro e número.')
  @ApiUnprocessableProblem()
  async create(@Body() dto: CreatePropertyDto): Promise<PropertyResponseDto> {
    return PropertyService.toView(await this.service.create(dto));
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Listar imóveis' })
  @ApiOkResponse({ type: PaginatedPropertiesResponseDto })
  list(@Query() query: PropertyPaginationDto): Promise<PaginatedPropertiesView> {
    return this.service.list(query);
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
    return PropertyService.toView(await this.service.getById(id));
  }
}
