import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { PropertyUnit } from '../../property/domain/property-unit.entity';
import { Tenant } from '../../tenant/domain/entities/tenant.entity';
import { Contract, ContractStatus } from '../domain/entities/contract.entity';
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
      .set({ _status: ContractStatus.EXPIRED } as never)
      .where('status = :active', { active: ContractStatus.ACTIVE })
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
      query.andWhere('contract.end_date >= :endFrom', { endFrom: options.endFrom });
    if (options.endTo) query.andWhere('contract.end_date <= :endTo', { endTo: options.endTo });
    const term = options.q?.trim();
    if (term) {
      const escaped = term.replace(/[\\%_]/g, (character) => `\\${character}`);
      const digits = term.replace(/\D/g, '');
      query.andWhere(
        `(
          CAST(contract.id AS text) ILIKE :q ESCAPE '\\'
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
    endDate: string,
    excludeId?: string,
  ): Promise<boolean> {
    const query = this.repository
      .createQueryBuilder('contract')
      .where('contract.property_unit_id = :propertyUnitId', { propertyUnitId })
      .andWhere('contract.status <> :terminated', { terminated: ContractStatus.TERMINATED })
      .andWhere('contract.move_in_date <= :endDate', { endDate })
      .andWhere('contract.end_date >= :startDate', { startDate });
    if (excludeId) query.andWhere('contract.id <> :excludeId', { excludeId });
    return query.getExists();
  }

  findActiveInPeriod(startDate: string, endDate: string): Promise<Contract[]> {
    return this.repository
      .createQueryBuilder('contract')
      .where('contract.status = :status', { status: ContractStatus.ACTIVE })
      .andWhere('contract.move_in_date <= :endDate', { endDate })
      .andWhere('contract.end_date >= :startDate', { startDate })
      .orderBy('contract.id', 'ASC')
      .getMany();
  }
}
