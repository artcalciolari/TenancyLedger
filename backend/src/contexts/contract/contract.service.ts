import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { Tenant } from '../tenant/domain/entities/tenant.entity';
import { PropertyUnit } from '../property/domain/property-unit.entity';
import { Contract, ContractStatus } from './domain/entities/contract.entity';
import { CONTRACT_REPOSITORY_TOKEN } from './domain/repositories/contract.repository.interface';
import type { IContractRepository } from './domain/repositories/contract.repository.interface';
import { TenantResponseDto } from '../tenant/infrastructure/http/dtos/tenant-response.dto';
import { civilDateInTimeZone } from '../../core/domain/civil-date';

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
  q?: string;
  moveInFrom?: string;
  moveInTo?: string;
  endFrom?: string;
  endTo?: string;
}

export interface ContractTenantSummary {
  id: string;
  cpf: string;
  profession: string;
  civilStatus: Tenant['civilStatus'];
  email: string;
  mobilePhone: string;
}

export interface ContractPropertySummary {
  id: string;
  neighborhood: string;
  type: PropertyUnit['type'];
  unitNumber: string;
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
  tenant?: ContractTenantSummary;
  propertyUnit?: ContractPropertySummary;
}

export interface DetailedContractView extends ContractView {
  tenant: ContractTenantSummary;
  propertyUnit: ContractPropertySummary;
}

export interface PaginatedContractsView {
  data: DetailedContractView[];
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
    await this.repository.markExpired(this.currentCivilDate());
    const contract = await this.repository.findById(id);
    if (!contract) throw new NotFoundException('Contrato não encontrado.');
    return contract;
  }

  async list(input: ListContractsInput): Promise<PaginatedContractsView> {
    const asOf = this.currentCivilDate();
    await this.repository.markExpired(asOf);
    const result = await this.repository.list({ ...input, asOf });
    const relations = await this.loadRelations(result.items);
    return {
      data: result.items.map((contract) =>
        this.detailedView(
          contract,
          relations.tenants.get(contract.tenantId),
          relations.properties.get(contract.propertyUnitId),
        ),
      ),
      meta: {
        page: input.page,
        limit: input.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / input.limit),
      },
    };
  }

  async renew(id: string, extraMonths: number): Promise<Contract> {
    await this.repository.markExpired(this.currentCivilDate());
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

  async toDetailedView(contract: Contract): Promise<DetailedContractView> {
    const relations = await this.loadRelations([contract]);
    return this.detailedView(
      contract,
      relations.tenants.get(contract.tenantId),
      relations.properties.get(contract.propertyUnitId),
    );
  }

  async exportCsv(input: ListContractsInput): Promise<string> {
    const asOf = this.currentCivilDate();
    await this.repository.markExpired(asOf);
    const contracts = await this.repository.listForExport({ ...input, asOf });
    const relations = await this.loadRelations(contracts);
    const header = [
      'id',
      'status',
      'moveInDate',
      'endDate',
      'monthlyBaseValueCents',
      'durationInMonths',
      'billingDay',
      'isRenewable',
      'tenantId',
      'tenantCpf',
      'tenantProfession',
      'propertyUnitId',
      'propertyNeighborhood',
      'propertyUnitNumber',
      'propertyType',
    ];
    const rows = contracts.map((contract) => {
      const tenant = relations.tenants.get(contract.tenantId);
      const property = relations.properties.get(contract.propertyUnitId);
      return [
        contract.id,
        contract.status,
        contract.moveInDate,
        contract.endDate,
        contract.monthlyBaseValueCents,
        contract.durationInMonths,
        contract.billingDay,
        contract.isRenewable,
        contract.tenantId,
        tenant?.cpf ?? '',
        tenant?.profession ?? '',
        contract.propertyUnitId,
        property?.neighborhood ?? '',
        property?.unitNumber ?? '',
        property?.type ?? '',
      ];
    });
    return [header, ...rows]
      .map((row) => row.map((value) => ContractService.csvCell(value)).join(','))
      .join('\r\n');
  }

  static toView(
    contract: Contract,
    tenant?: ContractTenantSummary,
    propertyUnit?: ContractPropertySummary,
  ): ContractView {
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
      ...(tenant ? { tenant } : {}),
      ...(propertyUnit ? { propertyUnit } : {}),
    };
  }

  private async loadRelations(contracts: readonly Contract[]): Promise<{
    tenants: Map<string, ContractTenantSummary>;
    properties: Map<string, ContractPropertySummary>;
  }> {
    const tenantIds = [...new Set(contracts.map((contract) => contract.tenantId))];
    const propertyIds = [...new Set(contracts.map((contract) => contract.propertyUnitId))];
    const [tenants, properties] = await Promise.all([
      tenantIds.length ? this.tenantRepository.findBy({ id: In(tenantIds) }) : [],
      propertyIds.length ? this.propertyRepository.findBy({ id: In(propertyIds) }) : [],
    ]);
    return {
      tenants: new Map(
        tenants.map((tenant) => {
          const view = TenantResponseDto.from(tenant);
          return [tenant.id, view];
        }),
      ),
      properties: new Map(
        properties.map((property) => [
          property.id,
          {
            id: property.id,
            neighborhood: property.neighborhood,
            type: property.type,
            unitNumber: property.unitNumber,
          },
        ]),
      ),
    };
  }

  private detailedView(
    contract: Contract,
    tenant: ContractTenantSummary | undefined,
    propertyUnit: ContractPropertySummary | undefined,
  ): DetailedContractView {
    if (!tenant || !propertyUnit) {
      throw new NotFoundException('Relacionamentos do contrato não encontrados.');
    }
    return ContractService.toView(contract, tenant, propertyUnit) as DetailedContractView;
  }

  private currentCivilDate(): string {
    return civilDateInTimeZone(new Date());
  }

  private static csvCell(value: string | number | boolean | null | undefined): string {
    const raw = String(value ?? '');
    const text = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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
