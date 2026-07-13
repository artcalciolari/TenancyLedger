import { ApiProperty } from '@nestjs/swagger';
import { PageMetaDto } from '../../core/infrastructure/http/openapi.dto';
import { UnitType } from './domain/property-unit.entity';

export class PropertyResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ maxLength: 120, example: 'Centro' })
  neighborhood!: string;

  @ApiProperty({ enum: UnitType, enumName: 'UnitType' })
  type!: UnitType;

  @ApiProperty({ maxLength: 40, example: '101-A' })
  unitNumber!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class PaginatedPropertiesResponseDto {
  @ApiProperty({ type: [PropertyResponseDto] })
  data!: PropertyResponseDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}
