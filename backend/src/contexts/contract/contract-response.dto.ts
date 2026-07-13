import { ApiProperty } from '@nestjs/swagger';
import { PageMetaDto } from '../../core/infrastructure/http/openapi.dto';
import { ContractStatus } from './domain/entities/contract.entity';

export class ContractResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  propertyUnitId!: string;

  @ApiProperty({ type: String, format: 'date', example: '2026-07-01' })
  moveInDate!: string;

  @ApiProperty({ type: String, format: 'date', example: '2027-06-30' })
  endDate!: string;

  @ApiProperty({ type: Number, minimum: 1, maximum: 2147483647, example: 150000 })
  monthlyBaseValueCents!: number;

  @ApiProperty({ minimum: 1, maximum: 600, example: 12 })
  durationInMonths!: number;

  @ApiProperty({ minimum: 1, maximum: 28, example: 10 })
  billingDay!: number;

  @ApiProperty()
  isRenewable!: boolean;

  @ApiProperty({ enum: ContractStatus, enumName: 'ContractStatus' })
  status!: ContractStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class PaginatedContractsResponseDto {
  @ApiProperty({ type: [ContractResponseDto] })
  data!: ContractResponseDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}
