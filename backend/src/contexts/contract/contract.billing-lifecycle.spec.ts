import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { calendarPeriodFrom } from '../../core/domain/calendar-period';
import { Invoice } from '../invoice/domain/entities/invoice.entity';
import { PropertyUnit, UnitType } from '../property/domain/property-unit.entity';
import { Tenant, TenantCivilStatus } from '../tenant/domain/entities/tenant.entity';
import { ContractService } from './contract.service';
import {
  Contract,
  ContractBadge,
  ContractStatus,
  ContractType,
} from './domain/entities/contract.entity';
import type { IContractRepository } from './domain/repositories/contract.repository.interface';

const CONTRACT_ID = '4d4d05b6-b5db-47c7-91fc-b0c86c036d9f';
const SECOND_CONTRACT_ID = '80e7dd97-eb89-4a3c-bfcf-e5669e560c06';
const TENANT_ID = '48bb503a-4d2a-4f56-88eb-6f7a9436ec67';
const PROPERTY_ID = 'c2926b25-4e17-44a8-8097-9c093f842cbb';

function assignId(target: object, id: string): void {
  Object.defineProperty(target, 'id', { value: id, configurable: true });
  Object.defineProperty(target, 'createdAt', {
    value: new Date('2026-07-18T10:00:00.000Z'),
    configurable: true,
  });
  Object.defineProperty(target, 'updatedAt', {
    value: new Date('2026-07-18T11:00:00.000Z'),
    configurable: true,
  });
}

function activeContract(id = CONTRACT_ID): Contract {
  const contract = Contract.create(
    TENANT_ID,
    PROPERTY_ID,
    '2026-07-18',
    185_000,
    null,
    true,
    18,
    ContractType.MONTH_TO_MONTH,
  );
  assignId(contract, id);
  return contract;
}

function pendingContract(): Contract {
  const contract = Contract.createPendingSignature(TENANT_ID, PROPERTY_ID, '2026-07-18', 185_000);
  assignId(contract, CONTRACT_ID);
  return contract;
}

function initialInvoice(overrides: { paid?: boolean; periodStart?: string } = {}): Invoice {
  const periodStart = overrides.periodStart ?? '2026-07-18';
  const period = calendarPeriodFrom(periodStart);
  const invoice = Invoice.create(
    CONTRACT_ID,
    period.start.slice(0, 7),
    185_000,
    periodStart,
    period.start,
    period.end,
  );
  if (overrides.paid ?? true) {
    invoice.settleCash(
      185_000,
      new Date('2026-07-18T12:00:00.000Z'),
      'test-settlement',
      'a'.repeat(64),
      '48bb503a-4d2a-4f56-88eb-6f7a9436ec67',
      '2026-07-18',
    );
  }
  return invoice;
}

describe('ContractService billing summaries and lifecycle transitions', () => {
  let repository: jest.Mocked<IContractRepository>;
  let findByIdForUpdate: jest.MockedFunction<IContractRepository['findByIdForUpdate']>;
  let save: jest.MockedFunction<IContractRepository['save']>;
  let service: ContractService;
  let invoiceRows: jest.Mock;
  let invoiceQuery: {
    select: jest.Mock;
    addSelect: jest.Mock;
    where: jest.Mock;
    setParameters: jest.Mock;
    groupBy: jest.Mock;
    getRawMany: jest.Mock;
  };
  let invoiceActivationQuery: {
    setLock: jest.Mock;
    where: jest.Mock;
    orderBy: jest.Mock;
    limit: jest.Mock;
    getOne: jest.Mock;
  };
  let contractRepoFindOne: jest.Mock;
  let contractRepoSave: jest.Mock;

  beforeEach(() => {
    findByIdForUpdate = jest.fn().mockResolvedValue(null);
    save = jest.fn().mockImplementation((contract: Contract) => Promise.resolve(contract));
    const runInTransaction = jest.fn(
      async <T>(operation: (transactional: IContractRepository) => Promise<T>) =>
        operation(repository),
    ) as unknown as jest.MockedFunction<IContractRepository['runInTransaction']>;
    repository = {
      save,
      findById: jest.fn().mockResolvedValue(null),
      findByIdForUpdate,
      runInTransaction,
      list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      listForExport: jest.fn().mockResolvedValue([]),
      hasOverlap: jest.fn().mockResolvedValue(false),
      findActiveInPeriod: jest.fn().mockResolvedValue([]),
      markExpired: jest.fn().mockResolvedValue(0),
    };
    invoiceRows = jest.fn().mockResolvedValue([]);
    invoiceQuery = {
      select: jest.fn(),
      addSelect: jest.fn(),
      where: jest.fn(),
      setParameters: jest.fn(),
      groupBy: jest.fn(),
      getRawMany: invoiceRows,
    };
    invoiceQuery.select.mockReturnValue(invoiceQuery);
    invoiceQuery.addSelect.mockReturnValue(invoiceQuery);
    invoiceQuery.where.mockReturnValue(invoiceQuery);
    invoiceQuery.setParameters.mockReturnValue(invoiceQuery);
    invoiceQuery.groupBy.mockReturnValue(invoiceQuery);
    invoiceActivationQuery = {
      setLock: jest.fn(),
      where: jest.fn(),
      orderBy: jest.fn(),
      limit: jest.fn(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    invoiceActivationQuery.setLock.mockReturnValue(invoiceActivationQuery);
    invoiceActivationQuery.where.mockReturnValue(invoiceActivationQuery);
    invoiceActivationQuery.orderBy.mockReturnValue(invoiceActivationQuery);
    invoiceActivationQuery.limit.mockReturnValue(invoiceActivationQuery);
    contractRepoFindOne = jest.fn().mockResolvedValue(null);
    contractRepoSave = jest
      .fn()
      .mockImplementation((contract: Contract) => Promise.resolve(contract));
    const transactionManager = {
      getRepository: jest.fn((entity: unknown) =>
        entity === Invoice
          ? { createQueryBuilder: jest.fn(() => invoiceActivationQuery) }
          : { findOne: contractRepoFindOne, save: contractRepoSave },
      ),
    };
    service = new ContractService(
      repository,
      {
        findBy: jest.fn().mockResolvedValue([
          {
            id: TENANT_ID,
            name: 'Maria da Silva',
            cpf: '52998224725',
            rg: '12.345.678-9',
            profession: 'Engenheira',
            civilStatus: TenantCivilStatus.SINGLE,
            email: 'maria@example.com',
            mobilePhone: '11987654321',
            photoStorageKey: null,
          } as Tenant,
        ]),
      } as unknown as Repository<Tenant>,
      {
        findBy: jest.fn().mockResolvedValue([
          {
            id: PROPERTY_ID,
            neighborhood: 'Centro',
            type: UnitType.APARTMENT,
            unitNumber: '101-A',
          } as PropertyUnit,
        ]),
      } as unknown as Repository<PropertyUnit>,
      {
        createQueryBuilder: jest.fn(() => invoiceQuery),
        manager: {
          transaction: jest.fn((callback: (manager: unknown) => unknown) =>
            callback(transactionManager),
          ),
        },
      } as unknown as Repository<Invoice>,
    );
  });

  it('projects paid-through dates, next renewal dates and overdue badges', async () => {
    const first = activeContract();
    const second = activeContract(SECOND_CONTRACT_ID);
    repository.list.mockResolvedValue({ items: [first, second], total: 2 });
    invoiceRows.mockResolvedValue([
      {
        contractId: CONTRACT_ID,
        paidThroughDate: '2026-08-17',
        paymentOverdue: true,
      },
      {
        contractId: SECOND_CONTRACT_ID,
        paidThroughDate: null,
        paymentOverdue: false,
      },
    ]);

    const result = await service.list({ page: 1, limit: 20 });

    expect(invoiceQuery.where.mock.calls).toContainEqual([
      'invoice.contract_id IN (:...contractIds)',
      { contractIds: [CONTRACT_ID, SECOND_CONTRACT_ID] },
    ]);
    expect(invoiceQuery.setParameters.mock.calls).toContainEqual([
      { paidStatus: 'PAID', overdueStatus: 'OVERDUE' },
    ]);
    expect(result.data[0]).toMatchObject({
      paidThroughDate: '2026-08-17',
      nextRenewalDate: '2026-08-18',
    });
    expect(result.data[0]?.badges).toContain(ContractBadge.PAYMENT_OVERDUE);
    expect(result.data[1]).toMatchObject({
      paidThroughDate: null,
      nextRenewalDate: null,
      badges: [],
    });
  });

  it('does not query invoice summaries for an empty contract page', async () => {
    await expect(service.list({ page: 1, limit: 20 })).resolves.toMatchObject({
      data: [],
      meta: { total: 0, totalPages: 0 },
    });
    expect(invoiceRows).not.toHaveBeenCalled();
  });

  it.each([
    [
      'marks a contract signed',
      () => pendingContract(),
      (current: ContractService) => current.markSigned(CONTRACT_ID),
      ContractStatus.PAYMENT_PENDING,
    ],
    [
      'schedules an active contract ending',
      () => activeContract(),
      (current: ContractService) => current.scheduleEnding(CONTRACT_ID, 'Saída programada'),
      ContractStatus.ENDING,
    ],
    [
      'cancels a pending contract',
      () => pendingContract(),
      (current: ContractService) => current.cancel(CONTRACT_ID, 'Cadastro cancelado'),
      ContractStatus.CANCELLED,
    ],
    [
      'terminates an active contract',
      () => activeContract(),
      (current: ContractService) => current.terminate(CONTRACT_ID, 'Entrega das chaves'),
      ContractStatus.TERMINATED,
    ],
  ] as const)('%s', async (_scenario, arrange, operation, expectedStatus) => {
    const contract = arrange();
    findByIdForUpdate.mockResolvedValue(contract);

    await expect(operation(service)).resolves.toBe(contract);

    expect(contract.status).toBe(expectedStatus);
    expect(save).toHaveBeenCalledWith(contract);
  });

  it('returns not found when a lifecycle transition cannot lock the contract', async () => {
    await expect(service.markSigned(CONTRACT_ID)).rejects.toEqual(
      new NotFoundException('Contrato não encontrado.'),
    );
    expect(save).not.toHaveBeenCalled();
  });

  describe('activate', () => {
    function signedContract(): Contract {
      const contract = pendingContract();
      contract.markSigned();
      return contract;
    }

    it('activates a contract whose initial invoice is fully paid, locking the invoice before the contract', async () => {
      const contract = signedContract();
      const invoice = initialInvoice();
      contractRepoFindOne.mockResolvedValue(contract);
      invoiceActivationQuery.getOne.mockResolvedValue(invoice);

      const result = await service.activate(CONTRACT_ID);

      expect(result).toBe(contract);
      expect(contract.status).toBe(ContractStatus.ACTIVE);
      expect(contractRepoSave).toHaveBeenCalledWith(contract);
      expect(invoiceActivationQuery.where).toHaveBeenCalledWith('invoice.contract_id = :id', {
        id: CONTRACT_ID,
      });
      expect(invoiceActivationQuery.setLock).toHaveBeenCalledWith('pessimistic_write');
    });

    it('rejects activation when the contract has no invoice at all', async () => {
      const contract = signedContract();
      contractRepoFindOne.mockResolvedValue(contract);
      invoiceActivationQuery.getOne.mockResolvedValue(null);

      await expect(service.activate(CONTRACT_ID)).rejects.toBeInstanceOf(ConflictException);
      expect(contract.status).toBe(ContractStatus.PAYMENT_PENDING);
      expect(contractRepoSave).not.toHaveBeenCalled();
    });

    it.each([
      ['OPEN', initialInvoice({ paid: false })],
      ['a later invoice period', initialInvoice({ periodStart: '2026-08-18' })],
    ])('rejects activation when the initial invoice is %s', async (_case, invoice) => {
      const contract = signedContract();
      contractRepoFindOne.mockResolvedValue(contract);
      invoiceActivationQuery.getOne.mockResolvedValue(invoice);

      await expect(service.activate(CONTRACT_ID)).rejects.toBeInstanceOf(ConflictException);
      expect(contract.status).toBe(ContractStatus.PAYMENT_PENDING);
      expect(contractRepoSave).not.toHaveBeenCalled();
    });

    it('rejects activation when the contract is not awaiting payment', async () => {
      const contract = activeContract();
      contractRepoFindOne.mockResolvedValue(contract);
      invoiceActivationQuery.getOne.mockResolvedValue(initialInvoice());

      await expect(service.activate(CONTRACT_ID)).rejects.toBeInstanceOf(ConflictException);
      expect(contractRepoSave).not.toHaveBeenCalled();
    });

    it('returns not found when the contract cannot be locked', async () => {
      invoiceActivationQuery.getOne.mockResolvedValue(initialInvoice());
      contractRepoFindOne.mockResolvedValue(null);

      await expect(service.activate(CONTRACT_ID)).rejects.toEqual(
        new NotFoundException('Contrato não encontrado.'),
      );
      expect(contractRepoSave).not.toHaveBeenCalled();
    });
  });
});
