import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { PropertyUnit } from '../../property/domain/property-unit.entity';
import { Tenant } from '../../tenant/domain/entities/tenant.entity';
import {
  Contract,
  ContractBadge,
  ContractStatus,
  ContractType,
} from '../domain/entities/contract.entity';
import {
  ContractListOptions,
  ContractFilterOptions,
  ContractListResult,
  IContractRepository,
} from '../domain/repositories/contract.repository.interface';

@Injectable()
export class ContractTypeOrmRepository implements IContractRepository {
  constructor(
    @InjectRepository(Contract)
    private readonly repository: Repository<Contract>,
  ) {}

  save(contract: Contract): Promise<Contract> {
    return this.repository.save(contract);
  }

  findById(id: string): Promise<Contract | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByIdForUpdate(id: string): Promise<Contract | null> {
    return this.repository.findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
  }

  runInTransaction<T>(operation: (repository: IContractRepository) => Promise<T>): Promise<T> {
    return this.repository.manager.transaction((manager) =>
      operation(new ContractTypeOrmRepository(manager.getRepository(Contract))),
    );
  }

  async list(options: ContractListOptions): Promise<ContractListResult> {
    const query = this.filteredQuery(options)
      .orderBy('contract.createdAt', 'DESC')
      .addOrderBy('contract.id', 'ASC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit);

    const [items, total] = await query.getManyAndCount();
    return { items, total };
  }

  listForExport(options: ContractFilterOptions): Promise<Contract[]> {
    return this.filteredQuery(options)
      .orderBy('contract.createdAt', 'DESC')
      .addOrderBy('contract.id', 'ASC')
      .getMany();
  }

  async markExpired(asOf: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .update(Contract)
      .set({
        _status: ContractStatus.EXPIRED,
        _statusReason: null,
        _statusChangedAt: () => 'CURRENT_TIMESTAMP',
      } as never)
      .where('status IN (:...expirableStatuses)', {
        expirableStatuses: [ContractStatus.ACTIVE, ContractStatus.ENDING],
      })
      .andWhere('contract_type = :fixedTerm', { fixedTerm: ContractType.FIXED_TERM })
      .andWhere('end_date < :asOf', { asOf })
      .execute();
    return result.affected ?? 0;
  }

  private filteredQuery(options: ContractFilterOptions): SelectQueryBuilder<Contract> {
    const query = this.repository
      .createQueryBuilder('contract')
      .leftJoin(Tenant, 'tenant', 'tenant.id = contract.tenant_id')
      .leftJoin(PropertyUnit, 'property', 'property.id = contract.property_unit_id');
    if (options.status) query.andWhere('contract.status = :status', { status: options.status });
    if (options.badge === ContractBadge.RENEWAL_DUE) {
      query
        .andWhere("contract.contract_type = 'MONTH_TO_MONTH'")
        .andWhere("contract.status = 'ACTIVE'")
        .andWhere(
          `EXISTS (
            SELECT 1
            FROM invoices renewal_invoice
            WHERE renewal_invoice.contract_id = contract.id
              AND renewal_invoice.status = 'PAID'
            GROUP BY renewal_invoice.contract_id
            HAVING (MAX(renewal_invoice.period_end) + 1) <= (:asOf::date + INTERVAL '3 days')::date
          )`,
          { asOf: options.asOf },
        );
    }
    if (options.badge === ContractBadge.PAYMENT_OVERDUE) {
      query.andWhere(
        `EXISTS (
          SELECT 1 FROM invoices overdue_invoice
          WHERE overdue_invoice.contract_id = contract.id
            AND overdue_invoice.status = 'OVERDUE'
        )`,
      );
    }
    if (options.renewalAttention) {
      query.andWhere(
        `(
          (
            contract.contract_type = 'MONTH_TO_MONTH'
            AND contract.status = 'ACTIVE'
            AND EXISTS (
              SELECT 1
              FROM invoices renewal_invoice
              WHERE renewal_invoice.contract_id = contract.id
                AND renewal_invoice.status = 'PAID'
              GROUP BY renewal_invoice.contract_id
              HAVING (MAX(renewal_invoice.period_end) + 1) <= (:asOf::date + INTERVAL '3 days')::date
            )
          )
          OR EXISTS (
            SELECT 1 FROM invoices overdue_invoice
            WHERE overdue_invoice.contract_id = contract.id
              AND overdue_invoice.status = 'OVERDUE'
          )
        )`,
        { asOf: options.asOf },
      );
    }
    if (options.tenantId)
      query.andWhere('contract.tenant_id = :tenantId', { tenantId: options.tenantId });
    if (options.propertyUnitId)
      query.andWhere('contract.property_unit_id = :propertyUnitId', {
        propertyUnitId: options.propertyUnitId,
      });
    if (options.moveInFrom)
      query.andWhere('contract.move_in_date >= :moveInFrom', { moveInFrom: options.moveInFrom });
    if (options.moveInTo)
      query.andWhere('contract.move_in_date <= :moveInTo', { moveInTo: options.moveInTo });
    if (options.endFrom)
      query.andWhere("COALESCE(contract.end_date, 'infinity'::date) >= :endFrom", {
        endFrom: options.endFrom,
      });
    if (options.endTo) query.andWhere('contract.end_date <= :endTo', { endTo: options.endTo });
    const term = options.q?.trim();
    if (term) {
      const escaped = term.replace(/[\\%_]/g, (character) => `\\${character}`);
      const digits = term.replace(/\D/g, '');
      query.andWhere(
        `(
          CAST(contract.id AS text) ILIKE :q ESCAPE '\\'
          OR tenant.full_name ILIKE :q ESCAPE '\\'
          OR tenant.profession ILIKE :q ESCAPE '\\'
          OR tenant.email ILIKE :q ESCAPE '\\'
          OR tenant.cpf LIKE :digits ESCAPE '\\'
          OR property.neighborhood ILIKE :q ESCAPE '\\'
          OR property.unit_number ILIKE :q ESCAPE '\\'
        )`,
        { q: `%${escaped}%`, digits: `%${digits || escaped}%` },
      );
    }
    return query;
  }

  hasOverlap(
    propertyUnitId: string,
    startDate: string,
    endDate: string | null,
    excludeId?: string,
  ): Promise<boolean> {
    const query = this.repository
      .createQueryBuilder('contract')
      .where('contract.property_unit_id = :propertyUnitId', { propertyUnitId })
      .andWhere('contract.status NOT IN (:...terminalStatuses)', {
        terminalStatuses: [ContractStatus.TERMINATED, ContractStatus.CANCELLED],
      })
      .andWhere("contract.move_in_date <= COALESCE(CAST(:endDate AS date), 'infinity'::date)", {
        endDate,
      })
      .andWhere("COALESCE(contract.end_date, 'infinity'::date) >= :startDate", { startDate });
    if (excludeId) query.andWhere('contract.id <> :excludeId', { excludeId });
    return query.getExists();
  }

  findActiveInPeriod(startDate: string, endDate: string): Promise<Contract[]> {
    return this.repository
      .createQueryBuilder('contract')
      .where('contract.status IN (:...statuses)', {
        statuses: [ContractStatus.ACTIVE, ContractStatus.ENDING],
      })
      .andWhere('contract.move_in_date <= :endDate', { endDate })
      .andWhere("COALESCE(contract.end_date, 'infinity'::date) >= :startDate", { startDate })
      .orderBy('contract.id', 'ASC')
      .getMany();
  }
}
