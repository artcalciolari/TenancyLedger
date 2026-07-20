import { Contract, ContractBadge, ContractStatus } from '../entities/contract.entity';

export const CONTRACT_REPOSITORY_TOKEN = Symbol('CONTRACT_REPOSITORY_TOKEN');

export interface ContractFilterOptions {
  asOf: string;
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

export interface ContractListOptions extends ContractFilterOptions {
  page: number;
  limit: number;
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
  listForExport(options: ContractFilterOptions): Promise<Contract[]>;
  markExpired(asOf: string): Promise<number>;
  hasOverlap(
    propertyUnitId: string,
    startDate: string,
    endDate: string | null,
    excludeId?: string,
  ): Promise<boolean>;
  findActiveInPeriod(startDate: string, endDate: string): Promise<Contract[]>;
}
