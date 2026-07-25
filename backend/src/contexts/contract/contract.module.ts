import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenant/domain/entities/tenant.entity';
import { Room } from '../property/domain/room.entity';
import { Building } from '../property/domain/building.entity';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { Contract } from './domain/entities/contract.entity';
import { CONTRACT_REPOSITORY_TOKEN } from './domain/repositories/contract.repository.interface';
import { ContractTypeOrmRepository } from './infrastructure/contract.typeorm.repository';
import { Invoice } from '../invoice/domain/entities/invoice.entity';
import { ContractDocument } from './domain/entities/contract-document.entity';
import { ContractDocumentsService } from './application/contract-documents.service';
import { ContractDocumentRenderer } from './infrastructure/contract-document.renderer';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contract, ContractDocument, Tenant, Room, Building, Invoice]),
  ],
  controllers: [ContractController],
  providers: [
    ContractService,
    ContractDocumentsService,
    ContractDocumentRenderer,
    { provide: CONTRACT_REPOSITORY_TOKEN, useClass: ContractTypeOrmRepository },
  ],
  exports: [ContractService, ContractDocumentsService, CONTRACT_REPOSITORY_TOKEN, TypeOrmModule],
})
export class ContractModule {}
