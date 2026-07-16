import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PageMetaDto } from '../../core/infrastructure/http/openapi.dto';
import { UnitType } from './domain/property-unit.entity';
import { BuildingDetailView, BuildingView } from './building.service';

export class BuildingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ maxLength: 120, example: 'Edifício Aurora' })
  name!: string;

  @ApiProperty({ maxLength: 120, example: 'Centro' })
  neighborhood!: string;

  @ApiPropertyOptional({
    type: String,
    maxLength: 200,
    example: 'Rua das Flores, 123',
    nullable: true,
  })
  address!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ example: 12 })
  totalUnits!: number;

  @ApiProperty({ example: 8 })
  occupiedUnits!: number;

  static from(view: BuildingView): BuildingResponseDto {
    return {
      id: view.id,
      name: view.name,
      neighborhood: view.neighborhood,
      address: view.address,
      createdAt: view.createdAt,
      totalUnits: view.totalUnits,
      occupiedUnits: view.occupiedUnits,
    };
  }
}

export class BuildingUnitResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ maxLength: 40, example: '101-A' })
  unitNumber!: string;

  @ApiProperty({ enum: UnitType, enumName: 'UnitType' })
  type!: UnitType;

  @ApiProperty({ maxLength: 120, example: 'Centro' })
  neighborhood!: string;

  @ApiProperty()
  occupied!: boolean;
}

export class BuildingDetailResponseDto extends BuildingResponseDto {
  @ApiProperty({ type: [BuildingUnitResponseDto] })
  units!: BuildingUnitResponseDto[];

  static fromDetail(view: BuildingDetailView): BuildingDetailResponseDto {
    return {
      ...BuildingResponseDto.from(view),
      units: view.units,
    };
  }
}

export class PaginatedBuildingsResponseDto {
  @ApiProperty({ type: [BuildingResponseDto] })
  data!: BuildingResponseDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}
