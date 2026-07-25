import { ApiProperty } from '@nestjs/swagger';
import { PageMetaDto } from '../../core/infrastructure/http/openapi.dto';

export class RoomResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  buildingId!: string;

  @ApiProperty({ maxLength: 40, example: '101' })
  number!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, example: 'Edifício Aurora' })
  buildingName!: string;

  @ApiProperty({ type: String, example: 'Centro' })
  buildingNeighborhood!: string;

  @ApiProperty({
    type: String,
    example: 'Rua das Flores, 123',
    nullable: true,
  })
  buildingAddress!: string | null;

  @ApiProperty({ example: false })
  occupied!: boolean;
}

export class PaginatedRoomsResponseDto {
  @ApiProperty({ type: [RoomResponseDto] })
  data!: RoomResponseDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}
