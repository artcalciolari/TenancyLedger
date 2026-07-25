import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsNotEmpty,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BuildingService } from './building.service';
import type { PaginatedBuildingsView } from './building.service';
import type { BuildingVacancyFilter } from './domain/building.repository';
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
  PartialType,
} from '@nestjs/swagger';
import {
  BuildingDetailResponseDto,
  BuildingResponseDto,
  PaginatedBuildingsResponseDto,
} from './building-response.dto';
import {
  ApiConflictProblem,
  ApiNotFoundProblem,
  ApiProtected,
  ApiUnprocessableProblem,
} from '../../core/infrastructure/http/openapi.decorators';
import { IsCivilDate } from '../../core/infrastructure/http/is-civil-date.decorator';

export enum BuildingVacancyFilterDto {
  WITH_VACANCY = 'WITH_VACANCY',
  FULL = 'FULL',
  NO_ROOMS = 'NO_ROOMS',
}

export class CreateBuildingDto {
  @ApiProperty({ minLength: 1, maxLength: 120, example: 'Edifício Aurora' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ minLength: 1, maxLength: 120, example: 'Centro' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  neighborhood!: string;

  @ApiPropertyOptional({ maxLength: 200, example: 'Rua das Flores, 123' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;
}

export class UpdateBuildingDto extends PartialType(CreateBuildingDto) {}

export class BuildingPaginationDto {
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
    description: 'Busca parcial por nome, bairro ou endereço.',
    example: 'Aurora',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ type: String, format: 'date', description: 'Padrão: data civil atual.' })
  @IsOptional()
  @IsCivilDate()
  date?: string;

  @ApiPropertyOptional({ enum: BuildingVacancyFilterDto, enumName: 'BuildingVacancyFilter' })
  @IsOptional()
  @IsEnum(BuildingVacancyFilterDto)
  vacancy?: BuildingVacancyFilter;
}

export class BuildingDetailQueryDto {
  @ApiPropertyOptional({ type: String, format: 'date', description: 'Padrão: data civil atual.' })
  @IsOptional()
  @IsCivilDate()
  date?: string;
}

@ApiProtected()
@ApiTags('Prédios')
@Controller('buildings')
export class BuildingController {
  constructor(private readonly service: BuildingService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Cadastrar prédio' })
  @ApiCreatedResponse({ type: BuildingResponseDto })
  @ApiConflictProblem('Já existe um prédio com este nome.')
  @ApiUnprocessableProblem()
  async create(@Body() dto: CreateBuildingDto): Promise<BuildingResponseDto> {
    const building = await this.service.create(dto);
    return BuildingResponseDto.from({
      id: building.id,
      name: building.name,
      neighborhood: building.neighborhood,
      address: building.address,
      createdAt: building.createdAt,
      totalRooms: 0,
      occupiedRooms: 0,
      vacantRooms: 0,
      vacancyPercentage: null,
    });
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Editar prédio' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: BuildingDetailResponseDto })
  @ApiNotFoundProblem('Prédio não encontrado.')
  @ApiConflictProblem('Já existe um prédio com este nome.')
  @ApiUnprocessableProblem()
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateBuildingDto,
  ): Promise<BuildingDetailResponseDto> {
    return BuildingDetailResponseDto.fromDetail(await this.service.update(id, dto));
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Listar prédios' })
  @ApiOkResponse({ type: PaginatedBuildingsResponseDto })
  list(@Query() query: BuildingPaginationDto): Promise<PaginatedBuildingsView> {
    return this.service.list(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Consultar prédio' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: BuildingDetailResponseDto })
  @ApiNotFoundProblem('Prédio não encontrado.')
  async get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: BuildingDetailQueryDto,
  ): Promise<BuildingDetailResponseDto> {
    return BuildingDetailResponseDto.fromDetail(await this.service.getById(id, query.date));
  }
}
