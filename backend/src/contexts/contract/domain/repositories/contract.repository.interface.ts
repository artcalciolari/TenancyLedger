import { Contract, ContractStatus } from '../entities/contract.entity';

export const CONTRACT_REPOSITORY_TOKEN = Symbol('CONTRACT_REPOSITORY_TOKEN');

export interface ContractListOptions {
  page: number;
  limit: number;
  status?: ContractStatus;
  tenantId?: string;
  propertyUnitId?: string;
}

export interface ContractListResult {
  items: Contract[];
  total: number;
}

export interface IContractRepository {
  save(contract: Contract): Promise<Contract>;
  findById(id: string): Promise<Contract | null>;
  findByIdForUpdate(id: string): Promise<Contract | null>;
  runInTransaction<T>(operation: (repository: IContractRepository) => Promise<T>): Promise<T>;
  list(options: ContractListOptions): Promise<ContractListResult>;
  hasOverlap(
    propertyUnitId: string,
    startDate: string,
    endDate: string,
    excludeId?: string,
  ): Promise<boolean>;
  findActiveInPeriod(startDate: string, endDate: string): Promise<Contract[]>;
}
