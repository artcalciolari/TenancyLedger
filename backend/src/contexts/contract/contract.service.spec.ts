import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { Room } from '../property/domain/room.entity';
import { Building } from '../property/domain/building.entity';
import { Tenant } from '../tenant/domain/entities/tenant.entity';
import { TenantCivilStatus } from '../tenant/domain/entities/tenant.entity';
import { ContractService, CreateContractInput } from './contract.service';
import {
  Contract,
  ContractBadge,
  ContractStatus,
  ContractType,
} from './domain/entities/contract.entity';
import type { IContractRepository } from './domain/repositories/contract.repository.interface';

const CONTRACT_ID = '8768a5d6-1a7e-41b9-bbd0-cd18f4d4ad9c';
const TENANT_ID = '48bb503a-4d2a-4f56-88eb-6f7a9436ec67';
const ROOM_ID = 'c2926b25-4e17-44a8-8097-9c093f842cbb';
const BUILDING_ID = '3d6f0c9e-3c9a-4d3b-9d0a-8f6e5c1a2b3c';
const SECOND_CONTRACT_ID = 'c69df19a-100c-4131-bf25-64ee7e249f66';
const SECOND_TENANT_ID = '15821999-f689-46d2-b2e7-ce1aef5a6ebf';
const SECOND_ROOM_ID = 'b3309ca5-a4ef-4575-a627-60d2ad635aee';
const SECOND_BUILDING_ID = '5a6d9d30-f66f-48fb-bd0a-e02afc972b65';
const CREATED_AT = new Date('2026-07-12T12:00:00.000Z');
const UPDATED_AT = new Date('2026-07-12T13:00:00.000Z');

const input: CreateContractInput = {
  tenantId: TENANT_ID,
  roomId: ROOM_ID,
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
      values.roomId,
      values.moveInDate,
      values.monthlyBaseValueCents,
      values.durationInMonths ?? null,
      values.isRenewable,
      values.billingDay,
      values.contractType,
    ),
  );
}

function queryFailure(code: string): QueryFailedError {
  const driverError = Object.assign(new Error(`PostgreSQL ${code}`), { code });
  return new QueryFailedError('INSERT INTO contracts', [], driverError);
}

function queryFailureWithDriverError(driverError: unknown): QueryFailedError {
  const error = queryFailure('unclassified');
  Object.defineProperty(error, 'driverError', { value: driverError });
  return error;
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
  let roomExistsBy: jest.MockedFunction<ExistsBy>;
  let tenantFindBy: jest.Mock;
  let roomFindBy: jest.Mock;
  let buildingFindBy: jest.Mock;

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
      listForExport: jest.fn().mockResolvedValue([]),
      markExpired: jest.fn().mockResolvedValue(0),
    };
    tenantExistsBy = jest.fn().mockResolvedValue(true);
    roomExistsBy = jest.fn().mockResolvedValue(true);
    tenantFindBy = jest.fn().mockResolvedValue([
      {
        id: TENANT_ID,
        cpf: '12345678909',
        profession: 'Engenheiro civil',
        civilStatus: TenantCivilStatus.SINGLE,
        email: 'locatario@example.com',
        mobilePhone: '11999999999',
      } as Tenant,
    ]);
    roomFindBy = jest.fn().mockResolvedValue([
      {
        id: ROOM_ID,
        number: '101-A',
        buildingId: BUILDING_ID,
      } as Room,
    ]);
    buildingFindBy = jest.fn().mockResolvedValue([
      {
        id: BUILDING_ID,
        name: 'Edifício Aurora',
        neighborhood: 'Centro',
      } as Building,
    ]);
    service = new ContractService(
      repository,
      { existsBy: tenantExistsBy, findBy: tenantFindBy } as unknown as Repository<Tenant>,
      { existsBy: roomExistsBy, findBy: roomFindBy } as unknown as Repository<Room>,
      { findBy: buildingFindBy } as unknown as Repository<Building>,
    );
  });

  describe('create', () => {
    it('validates both references and persists a contract without an overlap', async () => {
      const result = await service.create(input);

      expect(result).toMatchObject({
        tenantId: TENANT_ID,
        roomId: ROOM_ID,
        moveInDate: '2026-07-15',
        endDate: '2027-07-14',
        monthlyBaseValueCents: 185_000,
        durationInMonths: 12,
        billingDay: 10,
        isRenewable: true,
        status: ContractStatus.ACTIVE,
      });
      expect(tenantExistsBy).toHaveBeenCalledWith({ id: TENANT_ID });
      expect(roomExistsBy).toHaveBeenCalledWith({ id: ROOM_ID });
      expect(hasOverlap).toHaveBeenCalledWith(ROOM_ID, '2026-07-15', '2027-07-14');
      expect(save).toHaveBeenCalledWith(result);
    });

    it('normalizes an omitted duration for a month-to-month contract', async () => {
      const result = await service.create({
        ...input,
        durationInMonths: undefined,
        contractType: ContractType.MONTH_TO_MONTH,
      });

      expect(result).toMatchObject({
        contractType: ContractType.MONTH_TO_MONTH,
        durationInMonths: null,
        endDate: null,
      });
    });

    it('rejects a missing tenant before checking overlap or saving', async () => {
      tenantExistsBy.mockResolvedValue(false);

      await expect(service.create(input)).rejects.toThrow(
        new NotFoundException('Inquilino não encontrado.'),
      );

      expect(roomExistsBy).toHaveBeenCalledWith({ id: ROOM_ID });
      expect(hasOverlap).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    });

    it('rejects a missing room before checking overlap or saving', async () => {
      roomExistsBy.mockResolvedValue(false);

      await expect(service.create(input)).rejects.toThrow(
        new NotFoundException('Quarto não encontrado.'),
      );

      expect(hasOverlap).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    });

    it('rejects an overlap found by the pre-check', async () => {
      hasOverlap.mockResolvedValue(true);

      await expect(service.create(input)).rejects.toThrow(
        new ConflictException('O quarto já possui um contrato com vigência sobreposta.'),
      );

      expect(save).not.toHaveBeenCalled();
    });

    it('maps a concurrent PostgreSQL exclusion violation to a conflict', async () => {
      save.mockRejectedValue(queryFailure('23P01'));

      await expect(service.create(input)).rejects.toThrow(
        new ConflictException('O quarto já possui um contrato com vigência sobreposta.'),
      );
    });

    it('preserves an unexpected persistence error', async () => {
      const error = new Error('database unavailable');
      save.mockRejectedValue(error);

      await expect(service.create(input)).rejects.toBe(error);
    });

    it.each([
      queryFailure('23505'),
      queryFailureWithDriverError(null),
      queryFailureWithDriverError('malformed driver error'),
      queryFailureWithDriverError({ code: 23_505 }),
    ])('preserves a non-exclusion or malformed database failure', async (error) => {
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
        roomId: ROOM_ID,
      };

      await expect(service.list(options)).resolves.toMatchObject({
        data: [
          {
            id: CONTRACT_ID,
            tenantId: TENANT_ID,
            roomId: ROOM_ID,
            moveInDate: '2026-07-15',
            endDate: '2027-07-14',
            monthlyBaseValueCents: 185_000,
            durationInMonths: 12,
            billingDay: 10,
            isRenewable: true,
            status: ContractStatus.ACTIVE,
            createdAt: CREATED_AT,
            updatedAt: UPDATED_AT,
            tenant: {
              id: TENANT_ID,
              cpf: '***.***.***-09',
              profession: 'Engenheiro civil',
              civilStatus: TenantCivilStatus.SINGLE,
              email: 'l***@example.com',
              mobilePhone: '(**) *****-9999',
            },
            room: {
              id: ROOM_ID,
              number: '101-A',
              buildingId: BUILDING_ID,
              buildingName: 'Edifício Aurora',
              neighborhood: 'Centro',
            },
          },
        ],
        meta: { page: 2, limit: 10, total: 21, totalPages: 3 },
      });
      expect(list).toHaveBeenCalledWith(expect.objectContaining(options));
      expect(list.mock.calls[0]?.[0].asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('passes the renewalAttention filter through to the repository', async () => {
      list.mockResolvedValue({ items: [], total: 0 });

      await service.list({ page: 1, limit: 20, renewalAttention: true });

      expect(list).toHaveBeenCalledWith(expect.objectContaining({ renewalAttention: true }));
    });

    it('returns an empty page without querying relation repositories', async () => {
      await expect(service.list({ page: 1, limit: 20 })).resolves.toEqual({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      expect(tenantFindBy).not.toHaveBeenCalled();
      expect(roomFindBy).not.toHaveBeenCalled();
    });

    it('fails explicitly when a room references a building that cannot be found', async () => {
      const contract = persistedContract();
      list.mockResolvedValue({ items: [contract], total: 1 });
      buildingFindBy.mockResolvedValue([]);

      await expect(service.list({ page: 1, limit: 20 })).rejects.toThrow(
        'Relacionamentos do contrato não encontrados.',
      );
    });
  });

  describe('exportCsv', () => {
    it('serializes a null helper value as an empty cell', () => {
      expect(
        (
          ContractService as unknown as {
            csvCell(value: null): string;
          }
        ).csvCell(null),
      ).toBe('');
    });

    it('neutralizes =, +, -, and @ formula prefixes in exported contract cells', async () => {
      const first = persistedContract();
      const second = assignPersistenceFields(
        Contract.create(SECOND_TENANT_ID, SECOND_ROOM_ID, '2026-08-01', 210_000, 12, true, 12),
        SECOND_CONTRACT_ID,
      );
      repository.listForExport.mockResolvedValue([first, second]);
      tenantFindBy.mockResolvedValue([
        {
          id: TENANT_ID,
          cpf: '12345678909',
          profession: 'Engenheiro civil',
          civilStatus: TenantCivilStatus.SINGLE,
          email: 'primeiro@example.com',
          mobilePhone: '11999999999',
        } as Tenant,
        {
          id: SECOND_TENANT_ID,
          cpf: '52998224725',
          profession: 'Arquiteta',
          civilStatus: TenantCivilStatus.SINGLE,
          email: 'segunda@example.com',
          mobilePhone: '11988888888',
        } as Tenant,
      ]);
      roomFindBy.mockResolvedValue([
        {
          id: ROOM_ID,
          number: '+SUM(A1:A2)',
          buildingId: BUILDING_ID,
        } as Room,
        {
          id: SECOND_ROOM_ID,
          number: '@SUM(A1:A2)',
          buildingId: SECOND_BUILDING_ID,
        } as Room,
      ]);
      buildingFindBy.mockResolvedValue([
        {
          id: BUILDING_ID,
          name: '=1+1',
          neighborhood: 'Centro',
        } as Building,
        {
          id: SECOND_BUILDING_ID,
          name: '-2+3',
          neighborhood: 'Centro',
        } as Building,
      ]);

      const csv = await service.exportCsv({ page: 1, limit: 20 });
      const cells = csv
        .split('\r\n')
        .slice(1)
        .flatMap((row) => row.split(','));

      expect(cells).toEqual(
        expect.arrayContaining(["'+SUM(A1:A2)", "'=1+1", "'@SUM(A1:A2)", "'-2+3"]),
      );
    });

    it('leaves missing optional relation fields empty in the export', async () => {
      repository.listForExport.mockResolvedValue([persistedContract()]);
      tenantFindBy.mockResolvedValue([]);
      roomFindBy.mockResolvedValue([]);

      const csv = await service.exportCsv({ page: 1, limit: 20 });
      const cells = csv.split('\r\n')[1]?.split(',');

      expect(cells).toHaveLength(16);
      expect(cells?.slice(9, 12)).toEqual(['', '', '']);
      expect(cells?.slice(13, 16)).toEqual(['', '', '']);
    });

    it('quotes delimiters, line breaks, and embedded quotes in relation fields', async () => {
      repository.listForExport.mockResolvedValue([persistedContract()]);
      buildingFindBy.mockResolvedValue([
        {
          id: BUILDING_ID,
          name: 'Centro, "Histórico"\nSul',
          neighborhood: 'Centro',
        } as Building,
      ]);

      const csv = await service.exportCsv({ page: 1, limit: 20 });

      expect(csv).toContain('"Centro, ""Histórico""\nSul"');
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
      expect(hasOverlap).toHaveBeenCalledWith(ROOM_ID, '2026-07-15', '2028-01-14', CONTRACT_ID);
      expect(save).toHaveBeenCalledWith(contract);
    });

    it('does not persist a renewal when the pre-check finds an overlap', async () => {
      findByIdForUpdate.mockResolvedValue(persistedContract());
      hasOverlap.mockResolvedValue(true);

      await expect(service.renew(CONTRACT_ID, 6)).rejects.toThrow(
        new ConflictException('A renovação sobrepõe outro contrato deste quarto.'),
      );

      expect(save).not.toHaveBeenCalled();
    });

    it('maps an exclusion violation raised while saving a renewal', async () => {
      findByIdForUpdate.mockResolvedValue(persistedContract());
      save.mockRejectedValue(queryFailure('23P01'));

      await expect(service.renew(CONTRACT_ID, 6)).rejects.toThrow(
        new ConflictException('O quarto já possui um contrato com vigência sobreposta.'),
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

    it('does not check overlap or persist when contract status forbids renewal', async () => {
      findByIdForUpdate.mockResolvedValue(persistedContract({ isRenewable: false }));

      await expect(service.renew(CONTRACT_ID, 6)).rejects.toThrow(
        'Este contrato não permite renovação.',
      );

      expect(hasOverlap).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    });

    it('reactivates an expired renewable contract after extending it', async () => {
      const contract = persistedContract();
      contract.markExpired('2028-01-01');
      findByIdForUpdate.mockResolvedValue(contract);

      const renewed = await service.renew(CONTRACT_ID, 6);

      expect(renewed.status).toBe(ContractStatus.ACTIVE);
      expect(renewed.endDate).toBe('2028-01-14');
      expect(save).toHaveBeenCalledWith(contract);
    });
  });

  describe('toDetailedView', () => {
    it('loads both relations and returns the detailed public view', async () => {
      const contract = persistedContract();

      await expect(service.toDetailedView(contract)).resolves.toMatchObject({
        id: CONTRACT_ID,
        tenant: { id: TENANT_ID, cpf: '***.***.***-09' },
        room: { id: ROOM_ID, number: '101-A' },
      });
    });

    it.each(['tenant', 'room'])(
      'rejects a contract whose %s relation disappeared',
      async (missingRelation) => {
        if (missingRelation === 'tenant') tenantFindBy.mockResolvedValue([]);
        else roomFindBy.mockResolvedValue([]);

        await expect(service.toDetailedView(persistedContract())).rejects.toThrow(
          new NotFoundException('Relacionamentos do contrato não encontrados.'),
        );
      },
    );
  });

  it('maps only public contract fields in toView', () => {
    const contract = persistedContract();

    expect(ContractService.toView(contract)).toMatchObject({
      id: CONTRACT_ID,
      tenantId: TENANT_ID,
      roomId: ROOM_ID,
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

  it('derives renewal and overdue badges from paid invoice coverage', () => {
    const contract = assignPersistenceFields(
      Contract.create(
        TENANT_ID,
        ROOM_ID,
        '2026-07-18',
        185_000,
        null,
        true,
        18,
        ContractType.MONTH_TO_MONTH,
      ),
    );

    expect(
      ContractService.toView(
        contract,
        undefined,
        undefined,
        {
          paidThroughDate: '2026-08-17',
          nextRenewalDate: '2026-08-18',
          paymentOverdue: true,
        },
        '2026-08-15',
      ),
    ).toMatchObject({
      paidThroughDate: '2026-08-17',
      nextRenewalDate: '2026-08-18',
      badges: [ContractBadge.RENEWAL_DUE, ContractBadge.PAYMENT_OVERDUE],
    });

    const cancelled = assignPersistenceFields(
      Contract.createPendingSignature(TENANT_ID, ROOM_ID, '2026-07-18', 185_000, 18),
    );
    cancelled.cancel('Cadastro descontinuado');
    expect(
      ContractService.toView(
        cancelled,
        undefined,
        undefined,
        {
          paidThroughDate: '2026-08-17',
          nextRenewalDate: '2026-08-18',
          paymentOverdue: false,
        },
        '2026-08-15',
      ).badges,
    ).toEqual([]);
  });

  it('fails explicitly when activation is used without the invoice repository', () => {
    expect(() => service.activate(CONTRACT_ID)).toThrow(
      'O repositório de faturas é obrigatório para ativar um contrato.',
    );
  });
});
