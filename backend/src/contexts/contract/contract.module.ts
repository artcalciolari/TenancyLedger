import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenant/domain/entities/tenant.entity';
import { PropertyUnit } from '../property/domain/property-unit.entity';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { Contract } from './domain/entities/contract.entity';
import { CONTRACT_REPOSITORY_TOKEN } from './domain/repositories/contract.repository.interface';
import { ContractTypeOrmRepository } from './infrastructure/contract.typeorm.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Contract, Tenant, PropertyUnit])],
  controllers: [ContractController],
  providers: [
    ContractService,
    { provide: CONTRACT_REPOSITORY_TOKEN, useClass: ContractTypeOrmRepository },
  ],
  exports: [ContractService, CONTRACT_REPOSITORY_TOKEN, TypeOrmModule],
})
export class ContractModule {}
