import { ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { Tenant } from '../tenant/domain/entities/tenant.entity';
import { PropertyUnit } from '../property/domain/property-unit.entity';
import {
  Contract,
  ContractBadge,
  ContractStatus,
  ContractType,
} from './domain/entities/contract.entity';
import { CONTRACT_REPOSITORY_TOKEN } from './domain/repositories/contract.repository.interface';
import type { IContractRepository } from './domain/repositories/contract.repository.interface';
import { TenantResponseDto } from '../tenant/infrastructure/http/dtos/tenant-response.dto';
import { UserRole } from '../auth/domain/entities/user.entity';
import { civilDateInTimeZone } from '../../core/domain/civil-date';
import { addCivilDays } from '../../core/domain/calendar-period';
import { Invoice, InvoiceStatus } from '../invoice/domain/entities/invoice.entity';
import { canActivateContract } from './domain/contract-activation.policy';

export interface CreateContractInput {
  tenantId: string;
  propertyUnitId: string;
  moveInDate: string;
  monthlyBaseValueCents: number;
  durationInMonths?: number | null;
  isRenewable: boolean;
  billingDay?: number;
  contractType?: ContractType;
}

export interface ListContractsInput {
  page: number;
  limit: number;
  status?: ContractStatus;
  badge?: ContractBadge;
  renewalAttention?: boolean;
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
  name: string;
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
  endDate: string | null;
  monthlyBaseValueCents: number;
  durationInMonths: number | null;
  billingDay: number;
  isRenewable: boolean;
  contractType: ContractType;
  status: ContractStatus;
  statusReason: string | null;
  statusChangedAt: Date;
  paidThroughDate: string | null;
  nextRenewalDate: string | null;
  badges: ContractBadge[];
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

export interface ContractBillingSummary {
  paidThroughDate: string | null;
  nextRenewalDate: string | null;
  paymentOverdue: boolean;
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
    @Optional()
    @InjectRepository(Invoice)
    private readonly invoiceRepository?: Repository<Invoice>,
  ) {}

  async create(input: CreateContractInput): Promise<Contract> {
    const contract = Contract.create(
      input.tenantId,
      input.propertyUnitId,
      input.moveInDate,
      input.monthlyBaseValueCents,
      input.durationInMonths ?? null,
      input.isRenewable,
      input.billingDay,
      input.contractType ?? ContractType.FIXED_TERM,
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

  async list(input: ListContractsInput, role?: UserRole): Promise<PaginatedContractsView> {
    const asOf = this.currentCivilDate();
    await this.repository.markExpired(asOf);
    const result = await this.repository.list({ ...input, asOf });
    const [relations, billing] = await Promise.all([
      this.loadRelations(result.items, role),
      this.loadBillingSummaries(result.items),
    ]);
    return {
      data: result.items.map((contract) =>
        this.detailedView(
          contract,
          relations.tenants.get(contract.tenantId),
          relations.properties.get(contract.propertyUnitId),
          billing.get(contract.id),
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

  markSigned(id: string): Promise<Contract> {
    return this.transition(id, (contract) => contract.markSigned());
  }

  activate(id: string): Promise<Contract> {
    const invoiceRepository = this.invoiceRepository;
    if (!invoiceRepository) {
      throw new Error('O repositório de faturas é obrigatório para ativar um contrato.');
    }
    return invoiceRepository.manager.transaction(async (manager) => {
      const initialInvoice = await manager
        .getRepository(Invoice)
        .createQueryBuilder('invoice')
        .setLock('pessimistic_write')
        .where('invoice.contract_id = :id', { id })
        .orderBy('invoice.period_start', 'ASC')
        .limit(1)
        .getOne();

      const contractRepository = manager.getRepository(Contract);
      const contract = await contractRepository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!contract) throw new NotFoundException('Contrato não encontrado.');

      if (!canActivateContract(contract, initialInvoice)) {
        throw new ConflictException(
          'A ativação exige a fatura inicial quitada com o contrato aguardando pagamento.',
        );
      }

      contract.activate();
      return contractRepository.save(contract);
    });
  }

  scheduleEnding(id: string, reason: string): Promise<Contract> {
    return this.transition(id, (contract) => contract.scheduleEnding(reason));
  }

  cancel(id: string, reason: string): Promise<Contract> {
    return this.transition(id, (contract) => contract.cancel(reason));
  }

  terminate(id: string, reason: string): Promise<Contract> {
    return this.transition(id, (contract) => contract.terminate(reason));
  }

  async toDetailedView(contract: Contract, role?: UserRole): Promise<DetailedContractView> {
    const [relations, billing] = await Promise.all([
      this.loadRelations([contract], role),
      this.loadBillingSummaries([contract]),
    ]);
    return this.detailedView(
      contract,
      relations.tenants.get(contract.tenantId),
      relations.properties.get(contract.propertyUnitId),
      billing.get(contract.id),
    );
  }

  async exportCsv(input: ListContractsInput, role?: UserRole): Promise<string> {
    const asOf = this.currentCivilDate();
    await this.repository.markExpired(asOf);
    const contracts = await this.repository.listForExport({ ...input, asOf });
    const relations = await this.loadRelations(contracts, role);
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
      'tenantName',
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
        tenant?.name ?? '',
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
    billing?: ContractBillingSummary,
    asOf = civilDateInTimeZone(new Date()),
  ): ContractView {
    const paidThroughDate = billing?.paidThroughDate ?? null;
    const nextRenewalDate = billing?.nextRenewalDate ?? null;
    const badges: ContractBadge[] = [];
    if (
      contract.contractType === ContractType.MONTH_TO_MONTH &&
      contract.status === ContractStatus.ACTIVE &&
      nextRenewalDate !== null &&
      nextRenewalDate <= addCivilDays(asOf, 3)
    ) {
      badges.push(ContractBadge.RENEWAL_DUE);
    }
    if (billing?.paymentOverdue) badges.push(ContractBadge.PAYMENT_OVERDUE);
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
      contractType: contract.contractType,
      status: contract.status,
      statusReason: contract.statusReason,
      statusChangedAt: contract.statusChangedAt,
      paidThroughDate,
      nextRenewalDate,
      badges,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
      ...(tenant ? { tenant } : {}),
      ...(propertyUnit ? { propertyUnit } : {}),
    };
  }

  private async loadRelations(
    contracts: readonly Contract[],
    role?: UserRole,
  ): Promise<{
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
          const view = TenantResponseDto.from(tenant, role);
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
    billing?: ContractBillingSummary,
  ): DetailedContractView {
    if (!tenant || !propertyUnit) {
      throw new NotFoundException('Relacionamentos do contrato não encontrados.');
    }
    return ContractService.toView(
      contract,
      tenant,
      propertyUnit,
      billing,
      this.currentCivilDate(),
    ) as DetailedContractView;
  }

  private async loadBillingSummaries(
    contracts: readonly Contract[],
  ): Promise<Map<string, ContractBillingSummary>> {
    const result = new Map<string, ContractBillingSummary>();
    if (!this.invoiceRepository || contracts.length === 0) return result;
    const contractIds = [...new Set(contracts.map((contract) => contract.id))];
    const rows = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('invoice.contract_id', 'contractId')
      .addSelect(
        `(MAX(invoice.period_end) FILTER (WHERE invoice.status = :paidStatus))::text`,
        'paidThroughDate',
      )
      .addSelect(`COALESCE(BOOL_OR(invoice.status = :overdueStatus), false)`, 'paymentOverdue')
      .where('invoice.contract_id IN (:...contractIds)', { contractIds })
      .setParameters({ paidStatus: InvoiceStatus.PAID, overdueStatus: InvoiceStatus.OVERDUE })
      .groupBy('invoice.contract_id')
      .getRawMany<{
        contractId: string;
        paidThroughDate: string | null;
        paymentOverdue: boolean;
      }>();
    for (const row of rows) {
      result.set(row.contractId, {
        paidThroughDate: row.paidThroughDate,
        nextRenewalDate: row.paidThroughDate ? addCivilDays(row.paidThroughDate, 1) : null,
        paymentOverdue: Boolean(row.paymentOverdue),
      });
    }
    return result;
  }

  private transition(id: string, change: (contract: Contract) => void): Promise<Contract> {
    return this.repository.runInTransaction(async (repository) => {
      const contract = await repository.findByIdForUpdate(id);
      if (!contract) throw new NotFoundException('Contrato não encontrado.');
      change(contract);
      return repository.save(contract);
    });
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
