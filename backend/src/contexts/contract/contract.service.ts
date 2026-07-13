import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Tenant } from '../tenant/domain/entities/tenant.entity';
import { PropertyUnit } from '../property/domain/property-unit.entity';
import { Contract, ContractStatus } from './domain/entities/contract.entity';
import { CONTRACT_REPOSITORY_TOKEN } from './domain/repositories/contract.repository.interface';
import type { IContractRepository } from './domain/repositories/contract.repository.interface';

export interface CreateContractInput {
  tenantId: string;
  propertyUnitId: string;
  moveInDate: string;
  monthlyBaseValueCents: number;
  durationInMonths: number;
  isRenewable: boolean;
  billingDay?: number;
}

export interface ListContractsInput {
  page: number;
  limit: number;
  status?: ContractStatus;
  tenantId?: string;
  propertyUnitId?: string;
}

export interface ContractView {
  id: string;
  tenantId: string;
  propertyUnitId: string;
  moveInDate: string;
  endDate: string;
  monthlyBaseValueCents: number;
  durationInMonths: number;
  billingDay: number;
  isRenewable: boolean;
  status: ContractStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedContractsView {
  data: ContractView[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

@Injectable()
export class ContractService {
  constructor(
    @Inject(CONTRACT_REPOSITORY_TOKEN)
    private readonly repository: IContractRepository,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(PropertyUnit)
    private readonly propertyRepository: Repository<PropertyUnit>,
  ) {}

  async create(input: CreateContractInput): Promise<Contract> {
    const contract = Contract.create(
      input.tenantId,
      input.propertyUnitId,
      input.moveInDate,
      input.monthlyBaseValueCents,
      input.durationInMonths,
      input.isRenewable,
      input.billingDay,
    );

    const [tenantExists, propertyExists] = await Promise.all([
      this.tenantRepository.existsBy({ id: contract.tenantId }),
      this.propertyRepository.existsBy({ id: contract.propertyUnitId }),
    ]);
    if (!tenantExists) throw new NotFoundException('Inquilino não encontrado.');
    if (!propertyExists) throw new NotFoundException('Unidade imobiliária não encontrada.');

    if (
      await this.repository.hasOverlap(
        contract.propertyUnitId,
        contract.moveInDate,
        contract.endDate,
      )
    ) {
      throw new ConflictException('A unidade já possui um contrato com vigência sobreposta.');
    }

    return this.saveWithoutOverlap(contract);
  }

  async getById(id: string): Promise<Contract> {
    const contract = await this.repository.findById(id);
    if (!contract) throw new NotFoundException('Contrato não encontrado.');
    return contract;
  }

  async list(input: ListContractsInput): Promise<PaginatedContractsView> {
    const result = await this.repository.list(input);
    return {
      data: result.items.map((contract) => ContractService.toView(contract)),
      meta: {
        page: input.page,
        limit: input.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / input.limit),
      },
    };
  }

  async renew(id: string, extraMonths: number): Promise<Contract> {
    return this.repository.runInTransaction(async (repository) => {
      const contract = await repository.findByIdForUpdate(id);
      if (!contract) throw new NotFoundException('Contrato não encontrado.');

      contract.renew(extraMonths);
      if (
        await repository.hasOverlap(
          contract.propertyUnitId,
          contract.moveInDate,
          contract.endDate,
          contract.id,
        )
      ) {
        throw new ConflictException('A renovação sobrepõe outro contrato desta unidade.');
      }
      return this.saveWithoutOverlap(contract, repository);
    });
  }

  static toView(contract: Contract): ContractView {
    return {
      id: contract.id,
      tenantId: contract.tenantId,
      propertyUnitId: contract.propertyUnitId,
      moveInDate: contract.moveInDate,
      endDate: contract.endDate,
      monthlyBaseValueCents: contract.monthlyBaseValueCents,
      durationInMonths: contract.durationInMonths,
      billingDay: contract.billingDay,
      isRenewable: contract.isRenewable,
      status: contract.status,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
    };
  }

  private async saveWithoutOverlap(
    contract: Contract,
    repository: IContractRepository = this.repository,
  ): Promise<Contract> {
    try {
      return await repository.save(contract);
    } catch (error: unknown) {
      if (this.databaseErrorCode(error) === '23P01') {
        throw new ConflictException('A unidade já possui um contrato com vigência sobreposta.');
      }
      throw error;
    }
  }

  private databaseErrorCode(error: unknown): string | undefined {
    if (!(error instanceof QueryFailedError)) return undefined;
    const driverError: unknown = error.driverError;
    if (typeof driverError !== 'object' || driverError === null) return undefined;
    const code = Reflect.get(driverError, 'code') as unknown;
    return typeof code === 'string' ? code : undefined;
  }
}
