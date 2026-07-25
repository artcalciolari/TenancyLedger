import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RoomService } from './room.service';
import type { PaginatedRoomsView } from './room.service';
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
import { PaginatedRoomsResponseDto, RoomResponseDto } from './room-response.dto';
import {
  ApiConflictProblem,
  ApiNotFoundProblem,
  ApiProtected,
  ApiUnprocessableProblem,
} from '../../core/infrastructure/http/openapi.decorators';
import { IsCivilDate } from '../../core/infrastructure/http/is-civil-date.decorator';

export enum RoomAvailabilityStatusDto {
  VACANT = 'VACANT',
  OCCUPIED = 'OCCUPIED',
}

export class CreateRoomDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  buildingId!: string;

  @ApiProperty({ minLength: 1, maxLength: 40, example: '101' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  number!: string;
}

export class UpdateRoomDto extends PartialType(OmitType(CreateRoomDto, ['buildingId'] as const)) {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Campo imutável; presente apenas para explicitar a rejeição de alterações.',
  })
  @IsOptional()
  @IsUUID('4')
  buildingId?: string;
}

export class RoomPaginationDto {
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
    description: 'Busca por número do quarto, nome, bairro ou endereço do prédio.',
    example: 'Centro',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  buildingId?: string;

  @ApiPropertyOptional({ enum: RoomAvailabilityStatusDto, enumName: 'RoomAvailabilityStatus' })
  @IsOptional()
  @IsEnum(RoomAvailabilityStatusDto)
  status?: RoomAvailabilityStatusDto;

  @ApiPropertyOptional({ type: String, format: 'date', description: 'Padrão: data civil atual.' })
  @IsOptional()
  @IsCivilDate()
  date?: string;
}

@ApiProtected()
@ApiTags('Quartos')
@Controller('rooms')
export class RoomController {
  constructor(private readonly service: RoomService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Cadastrar quarto' })
  @ApiCreatedResponse({ type: RoomResponseDto })
  @ApiNotFoundProblem('Prédio não encontrado.')
  @ApiConflictProblem('Já existe um quarto com este número neste prédio.')
  @ApiUnprocessableProblem()
  async create(@Body() dto: CreateRoomDto): Promise<RoomResponseDto> {
    const room = await this.service.create(dto);
    return this.service.getById(room.id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Editar quarto' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: RoomResponseDto })
  @ApiNotFoundProblem('Quarto não encontrado.')
  @ApiConflictProblem('Já existe um quarto com este número neste prédio.')
  @ApiUnprocessableProblem()
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateRoomDto,
  ): Promise<RoomResponseDto> {
    await this.service.update(id, dto);
    return this.service.getById(id);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Listar quartos' })
  @ApiOkResponse({ type: PaginatedRoomsResponseDto })
  list(@Query() query: RoomPaginationDto): Promise<PaginatedRoomsView> {
    return this.service.list(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Consultar quarto' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: RoomResponseDto })
  @ApiNotFoundProblem('Quarto não encontrado.')
  async get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<RoomResponseDto> {
    return this.service.getById(id);
  }
}
