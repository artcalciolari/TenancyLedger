import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract, ContractStatus } from '../domain/entities/contract.entity';
import {
  ContractListOptions,
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
    const query = this.repository
      .createQueryBuilder('contract')
      .orderBy('contract.created_at', 'DESC')
      .addOrderBy('contract.id', 'ASC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit);

    if (options.status) query.andWhere('contract.status = :status', { status: options.status });
    if (options.tenantId)
      query.andWhere('contract.tenant_id = :tenantId', { tenantId: options.tenantId });
    if (options.propertyUnitId)
      query.andWhere('contract.property_unit_id = :propertyUnitId', {
        propertyUnitId: options.propertyUnitId,
      });

    const [items, total] = await query.getManyAndCount();
    return { items, total };
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
