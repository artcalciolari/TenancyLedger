import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Contract, ContractStatus } from './domain/entities/contract.entity';
import { ContractService } from './contract.service';
import type { ContractView, PaginatedContractsView } from './contract.service';
import { UserRole } from '../auth/domain/entities/user.entity';
import { Roles } from '../auth/infrastructure/security/roles.decorator';

export class CreateContractDto {
  @IsUUID('4')
  tenantId!: string;

  @IsUUID('4')
  propertyUnitId!: string;

  @IsDateString({ strict: true })
  moveInDate!: string;

  @IsInt()
  @Min(1)
  @Max(Contract.MAX_MONEY_CENTS)
  monthlyBaseValueCents!: number;

  @IsInt()
  @Min(1)
  @Max(600)
  durationInMonths!: number;

  @IsBoolean()
  isRenewable!: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  billingDay?: number;
}

export class ContractPaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @IsOptional()
  @IsUUID('4')
  tenantId?: string;

  @IsOptional()
  @IsUUID('4')
  propertyUnitId?: string;
}

export class RenewContractDto {
  @IsInt()
  @Min(1)
  @Max(600)
  extraMonths!: number;
}

@Controller('contracts')
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async create(@Body() dto: CreateContractDto): Promise<ContractView> {
    return ContractService.toView(await this.contractService.create(dto));
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  list(@Query() query: ContractPaginationDto): Promise<PaginatedContractsView> {
    return this.contractService.list(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  async get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<ContractView> {
    return ContractService.toView(await this.contractService.getById(id));
  }

  @Patch(':id/renew')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async renew(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RenewContractDto,
  ): Promise<ContractView> {
    return ContractService.toView(await this.contractService.renew(id, dto.extraMonths));
  }
}
