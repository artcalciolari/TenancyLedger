import { ApiProperty } from '@nestjs/swagger';
import { PageMetaDto } from '../../core/infrastructure/http/openapi.dto';
import { ContractBadge, ContractStatus, ContractType } from './domain/entities/contract.entity';
import { TenantCivilStatus } from '../tenant/domain/entities/tenant.entity';
import { UnitType } from '../property/domain/property-unit.entity';

export class ContractTenantSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ example: 'Maria da Silva' })
  name!: string;
  @ApiProperty({ example: '***.***.***-09' })
  cpf!: string;
  @ApiProperty({ example: 'Engenheiro civil' })
  profession!: string;
  @ApiProperty({ enum: TenantCivilStatus, enumName: 'TenantCivilStatus' })
  civilStatus!: TenantCivilStatus;
  @ApiProperty({ example: 'l***@example.com' })
  email!: string;
  @ApiProperty({ example: '(**) *****-9999' })
  mobilePhone!: string;
}

export class ContractPropertySummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ example: 'Centro' })
  neighborhood!: string;
  @ApiProperty({ enum: UnitType, enumName: 'UnitType' })
  type!: UnitType;
  @ApiProperty({ example: '101-A' })
  unitNumber!: string;
}

export class ContractResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  propertyUnitId!: string;

  @ApiProperty({ type: String, format: 'date', example: '2026-07-01' })
  moveInDate!: string;

  @ApiProperty({ type: String, format: 'date', example: '2027-06-30', nullable: true })
  endDate!: string | null;

  @ApiProperty({ type: Number, minimum: 1, maximum: 2147483647, example: 150000 })
  monthlyBaseValueCents!: number;

  @ApiProperty({ type: Number, minimum: 1, maximum: 600, example: 12, nullable: true })
  durationInMonths!: number | null;

  @ApiProperty({ minimum: 1, maximum: 28, example: 10 })
  billingDay!: number;

  @ApiProperty()
  isRenewable!: boolean;

  @ApiProperty({ enum: ContractType, enumName: 'ContractType' })
  contractType!: ContractType;

  @ApiProperty({ enum: ContractStatus, enumName: 'ContractStatus' })
  status!: ContractStatus;

  @ApiProperty({ type: String, maxLength: 500, nullable: true })
  statusReason!: string | null;

  @ApiProperty({ format: 'date-time' })
  statusChangedAt!: Date;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  paidThroughDate!: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  nextRenewalDate!: string | null;

  @ApiProperty({ enum: ContractBadge, enumName: 'ContractBadge', isArray: true })
  badges!: ContractBadge[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: ContractTenantSummaryDto })
  tenant!: ContractTenantSummaryDto;

  @ApiProperty({ type: ContractPropertySummaryDto })
  propertyUnit!: ContractPropertySummaryDto;
}

export class PaginatedContractsResponseDto {
  @ApiProperty({ type: [ContractResponseDto] })
  data!: ContractResponseDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}
