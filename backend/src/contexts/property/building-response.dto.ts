import { ApiProperty } from '@nestjs/swagger';
import { PageMetaDto } from '../../core/infrastructure/http/openapi.dto';
import { BuildingDetailView, BuildingView } from './building.service';

export class BuildingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ maxLength: 120, example: 'Edifício Aurora' })
  name!: string;

  @ApiProperty({ maxLength: 120, example: 'Centro' })
  neighborhood!: string;

  @ApiProperty({
    type: String,
    maxLength: 200,
    example: 'Rua das Flores, 123',
    nullable: true,
  })
  address!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ example: 12 })
  totalRooms!: number;

  @ApiProperty({ example: 8 })
  occupiedRooms!: number;

  @ApiProperty({ example: 4 })
  vacantRooms!: number;

  @ApiProperty({
    type: Number,
    example: 33.3,
    nullable: true,
    description: 'Percentual de vagas com 1 casa decimal; nulo quando o prédio não tem quartos.',
  })
  vacancyPercentage!: number | null;

  static from(view: BuildingView): BuildingResponseDto {
    return {
      id: view.id,
      name: view.name,
      neighborhood: view.neighborhood,
      address: view.address,
      createdAt: view.createdAt,
      totalRooms: view.totalRooms,
      occupiedRooms: view.occupiedRooms,
      vacantRooms: view.vacantRooms,
      vacancyPercentage: view.vacancyPercentage,
    };
  }
}

export class BuildingRoomResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ maxLength: 40, example: '101' })
  number!: string;

  @ApiProperty()
  occupied!: boolean;
}

export class BuildingDetailResponseDto extends BuildingResponseDto {
  @ApiProperty({ type: [BuildingRoomResponseDto] })
  rooms!: BuildingRoomResponseDto[];

  static fromDetail(view: BuildingDetailView): BuildingDetailResponseDto {
    return {
      ...BuildingResponseDto.from(view),
      rooms: view.rooms,
    };
  }
}

export class PaginatedBuildingsResponseDto {
  @ApiProperty({ type: [BuildingResponseDto] })
  data!: BuildingResponseDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}
