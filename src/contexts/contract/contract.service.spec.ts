import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { PropertyUnit } from '../property/domain/property-unit.entity';
import { Tenant } from '../tenant/domain/entities/tenant.entity';
import { ContractService, CreateContractInput } from './contract.service';
import { Contract, ContractStatus } from './domain/entities/contract.entity';
import type { IContractRepository } from './domain/repositories/contract.repository.interface';

const CONTRACT_ID = '8768a5d6-1a7e-41b9-bbd0-cd18f4d4ad9c';
const TENANT_ID = '48bb503a-4d2a-4f56-88eb-6f7a9436ec67';
const PROPERTY_ID = 'c2926b25-4e17-44a8-8097-9c093f842cbb';
const CREATED_AT = new Date('2026-07-12T12:00:00.000Z');
const UPDATED_AT = new Date('2026-07-12T13:00:00.000Z');

const input: CreateContractInput = {
  tenantId: TENANT_ID,
  propertyUnitId: PROPERTY_ID,
  moveInDate: '2026-07-15',
  monthlyBaseValueCents: 185_000,
  durationInMonths: 12,
  isRenewable: true,
  billingDay: 10,
};

function assignPersistenceFields(contract: Contract, id = CONTRACT_ID): Contract {
  Object.defineProperties(contract, {
    id: { value: id, configurable: true },
    createdAt: { value: CREATED_AT, configurable: true },
    updatedAt: { value: UPDATED_AT, configurable: true },
  });
  return contract;
}

function persistedContract(overrides: Partial<CreateContractInput> = {}): Contract {
  const values = { ...input, ...overrides };
  return assignPersistenceFields(
    Contract.create(
      values.tenantId,
      values.propertyUnitId,
      values.moveInDate,
      values.monthlyBaseValueCents,
      values.durationInMonths,
      values.isRenewable,
      values.billingDay,
    ),
  );
}

function queryFailure(code: string): QueryFailedError {
  const driverError = Object.assign(new Error(`PostgreSQL ${code}`), { code });
  return new QueryFailedError('INSERT INTO contracts', [], driverError);
}

type ExistsBy = (criteria: { id: string }) => Promise<boolean>;

describe('ContractService', () => {
  let repository: jest.Mocked<IContractRepository>;
  let service: ContractService;
  let save: jest.MockedFunction<IContractRepository['save']>;
  let findById: jest.MockedFunction<IContractRepository['findById']>;
  let findByIdForUpdate: jest.MockedFunction<IContractRepository['findByIdForUpdate']>;
  let runInTransaction: jest.MockedFunction<IContractRepository['runInTransaction']>;
  let list: jest.MockedFunction<IContractRepository['list']>;
  let hasOverlap: jest.MockedFunction<IContractRepository['hasOverlap']>;
  let tenantExistsBy: jest.MockedFunction<ExistsBy>;
  let propertyExistsBy: jest.MockedFunction<ExistsBy>;

  beforeEach(() => {
    save = jest.fn().mockImplementation((contract: Contract) => Promise.resolve(contract));
    findById = jest.fn().mockResolvedValue(null);
    findByIdForUpdate = jest.fn().mockResolvedValue(null);
    list = jest.fn().mockResolvedValue({ items: [], total: 0 });
    hasOverlap = jest.fn().mockResolvedValue(false);
    runInTransaction = jest.fn(
      async <T>(operation: (transactional: IContractRepository) => Promise<T>) =>
        operation(repository),
    ) as unknown as jest.MockedFunction<IContractRepository['runInTransaction']>;
    repository = {
      save,
      findById,
      findByIdForUpdate,
      runInTransaction,
      list,
      hasOverlap,
      findActiveInPeriod: jest.fn().mockResolvedValue([]),
    };
    tenantExistsBy = jest.fn().mockResolvedValue(true);
    propertyExistsBy = jest.fn().mockResolvedValue(true);
    service = new ContractService(
      repository,
      { existsBy: tenantExistsBy } as unknown as Repository<Tenant>,
      { existsBy: propertyExistsBy } as unknown as Repository<PropertyUnit>,
    );
  });

  describe('create', () => {
    it('validates both references and persists a contract without an overlap', async () => {
      const result = await service.create(input);

      expect(result).toMatchObject({
        tenantId: TENANT_ID,
        propertyUnitId: PROPERTY_ID,
        moveInDate: '2026-07-15',
        endDate: '2027-07-14',
        monthlyBaseValueCents: 185_000,
        durationInMonths: 12,
        billingDay: 10,
        isRenewable: true,
        status: ContractStatus.ACTIVE,
      });
      expect(tenantExistsBy).toHaveBeenCalledWith({ id: TENANT_ID });
      expect(propertyExistsBy).toHaveBeenCalledWith({ id: PROPERTY_ID });
      expect(hasOverlap).toHaveBeenCalledWith(PROPERTY_ID, '2026-07-15', '2027-07-14');
      expect(save).toHaveBeenCalledWith(result);
    });

    it('rejects a missing tenant before checking overlap or saving', async () => {
      tenantExistsBy.mockResolvedValue(false);

      await expect(service.create(input)).rejects.toThrow(
        new NotFoundException('Inquilino não encontrado.'),
      );

      expect(propertyExistsBy).toHaveBeenCalledWith({ id: PROPERTY_ID });
      expect(hasOverlap).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    });

    it('rejects a missing property before checking overlap or saving', async () => {
      propertyExistsBy.mockResolvedValue(false);

      await expect(service.create(input)).rejects.toThrow(
        new NotFoundException('Unidade imobiliária não encontrada.'),
      );

      expect(hasOverlap).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    });

    it('rejects an overlap found by the pre-check', async () => {
      hasOverlap.mockResolvedValue(true);

      await expect(service.create(input)).rejects.toThrow(
        new ConflictException('A unidade já possui um contrato com vigência sobreposta.'),
      );

      expect(save).not.toHaveBeenCalled();
    });

    it('maps a concurrent PostgreSQL exclusion violation to a conflict', async () => {
      save.mockRejectedValue(queryFailure('23P01'));

      await expect(service.create(input)).rejects.toThrow(
        new ConflictException('A unidade já possui um contrato com vigência sobreposta.'),
      );
    });

    it('preserves an unexpected persistence error', async () => {
      const error = new Error('database unavailable');
      save.mockRejectedValue(error);

      await expect(service.create(input)).rejects.toBe(error);
    });
  });

  describe('getById', () => {
    it('returns the contract found by id', async () => {
      const contract = persistedContract();
      findById.mockResolvedValue(contract);

      await expect(service.getById(CONTRACT_ID)).resolves.toBe(contract);
      expect(findById).toHaveBeenCalledWith(CONTRACT_ID);
    });

    it('rejects an unknown contract', async () => {
      await expect(service.getById(CONTRACT_ID)).rejects.toThrow(
        new NotFoundException('Contrato não encontrado.'),
      );
    });
  });

  describe('list', () => {
    it('passes filters to the repository and returns paginated views', async () => {
      const contract = persistedContract();
      list.mockResolvedValue({ items: [contract], total: 21 });
      const options = {
        page: 2,
        limit: 10,
        status: ContractStatus.ACTIVE,
        tenantId: TENANT_ID,
        propertyUnitId: PROPERTY_ID,
      };

      await expect(service.list(options)).resolves.toEqual({
        data: [
          {
            id: CONTRACT_ID,
            tenantId: TENANT_ID,
            propertyUnitId: PROPERTY_ID,
            moveInDate: '2026-07-15',
            endDate: '2027-07-14',
            monthlyBaseValueCents: 185_000,
            durationInMonths: 12,
            billingDay: 10,
            isRenewable: true,
            status: ContractStatus.ACTIVE,
            createdAt: CREATED_AT,
            updatedAt: UPDATED_AT,
          },
        ],
        meta: { page: 2, limit: 10, total: 21, totalPages: 3 },
      });
      expect(list).toHaveBeenCalledWith(options);
    });
  });

  describe('renew', () => {
    it('extends the contract and excludes itself from the overlap check', async () => {
      const contract = persistedContract();
      findByIdForUpdate.mockResolvedValue(contract);

      const result = await service.renew(CONTRACT_ID, 6);

      expect(result).toBe(contract);
      expect(result.durationInMonths).toBe(18);
      expect(result.endDate).toBe('2028-01-14');
      expect(runInTransaction).toHaveBeenCalledTimes(1);
      expect(findByIdForUpdate).toHaveBeenCalledWith(CONTRACT_ID);
      expect(hasOverlap).toHaveBeenCalledWith(PROPERTY_ID, '2026-07-15', '2028-01-14', CONTRACT_ID);
      expect(save).toHaveBeenCalledWith(contract);
    });

    it('does not persist a renewal when the pre-check finds an overlap', async () => {
      findByIdForUpdate.mockResolvedValue(persistedContract());
      hasOverlap.mockResolvedValue(true);

      await expect(service.renew(CONTRACT_ID, 6)).rejects.toThrow(
        new ConflictException('A renovação sobrepõe outro contrato desta unidade.'),
      );

      expect(save).not.toHaveBeenCalled();
    });

    it('maps an exclusion violation raised while saving a renewal', async () => {
      findByIdForUpdate.mockResolvedValue(persistedContract());
      save.mockRejectedValue(queryFailure('23P01'));

      await expect(service.renew(CONTRACT_ID, 6)).rejects.toThrow(
        new ConflictException('A unidade já possui um contrato com vigência sobreposta.'),
      );
    });

    it('rejects an unknown contract from inside the locked transaction', async () => {
      await expect(service.renew(CONTRACT_ID, 6)).rejects.toThrow(
        new NotFoundException('Contrato não encontrado.'),
      );

      expect(runInTransaction).toHaveBeenCalledTimes(1);
      expect(findByIdForUpdate).toHaveBeenCalledWith(CONTRACT_ID);
      expect(save).not.toHaveBeenCalled();
    });
  });

  it('maps only public contract fields in toView', () => {
    const contract = persistedContract();

    expect(ContractService.toView(contract)).toEqual({
      id: CONTRACT_ID,
      tenantId: TENANT_ID,
      propertyUnitId: PROPERTY_ID,
      moveInDate: '2026-07-15',
      endDate: '2027-07-14',
      monthlyBaseValueCents: 185_000,
      durationInMonths: 12,
      billingDay: 10,
      isRenewable: true,
      status: ContractStatus.ACTIVE,
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    });
  });
});
