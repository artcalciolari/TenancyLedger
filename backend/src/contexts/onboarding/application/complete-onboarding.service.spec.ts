import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, type EntityManager, type Repository } from 'typeorm';
import { ValidationError } from '../../../core/domain/errors/validation.error';
import type { StorageService } from '../../../infrastructure/storage.service';
import {
  Contract,
  ContractStatus,
  ContractType,
} from '../../contract/domain/entities/contract.entity';
import { Invoice } from '../../invoice/domain/entities/invoice.entity';
import { PropertyUnit, UnitType } from '../../property/domain/property-unit.entity';
import { TenantReference } from '../../tenant/domain/entities/tenant-reference.entity';
import { Tenant, TenantCivilStatus } from '../../tenant/domain/entities/tenant.entity';
import { OnboardingDraft, OnboardingDraftStatus } from '../domain/onboarding-draft.entity';
import { CompleteOnboardingService } from './complete-onboarding.service';

const DRAFT_ID = 'dad91a88-583f-4b2a-9ac6-0d8eb14cd266';
const USER_ID = '7fdf9cde-2961-4ed2-a3ae-eedce12a42ee';
const TENANT_ID = '48bb503a-4d2a-4f56-88eb-6f7a9436ec67';
const PROPERTY_ID = 'c2926b25-4e17-44a8-8097-9c093f842cbb';
const CONTRACT_ID = '4d4d05b6-b5db-47c7-91fc-b0c86c036d9f';
const INVOICE_ID = '0a60a4ca-1a8e-4f0a-b0ee-2196db87ac51';
const DRAFT_PHOTO_KEY = `documents/onboarding-draft-photos/${DRAFT_ID}/9f8b2b8e-1c2b-4a2b-9c2b-1a2b3c4d5e6f.jpg`;
const PROMOTED_PHOTO_KEY = `documents/tenant-photos/${TENANT_ID}/9f8b2b8e-1c2b-4a2b-9c2b-1a2b3c4d5e6f.jpg`;

function payload(): Record<string, unknown> {
  return {
    version: 1,
    personalData: {
      name: 'Maria da Silva',
      cpf: '52998224725',
      rg: '12.345.678-9',
      profession: 'Engenheira civil',
      civilStatus: TenantCivilStatus.SINGLE,
      email: 'maria@example.com',
      mobilePhone: '11987654321',
    },
    photo: null,
    references: [
      {
        name: 'João da Silva',
        relationship: 'Irmão',
        phone: '11976543210',
        email: 'joao@example.com',
      },
      {
        name: 'Ana Souza',
        relationship: 'Amiga',
        phone: '1134567890',
      },
      {
        name: 'Carlos Lima',
        relationship: 'Colega',
        phone: '11912345678',
        email: '   ',
      },
    ],
    propertyUnitId: PROPERTY_ID,
    moveInDate: '2026-07-18',
    monthlyBaseValueCents: 185_000,
  };
}

function draft(value: unknown = payload()): OnboardingDraft {
  return Object.assign(OnboardingDraft.create(value, USER_ID), { id: DRAFT_ID });
}

function queryFailure(code: string, driverErrorOverride?: unknown): QueryFailedError {
  const error = new QueryFailedError(
    'INSERT',
    [],
    Object.assign(new Error(`PostgreSQL ${code}`), { code }),
  );
  if (arguments.length > 1) {
    Object.defineProperty(error, 'driverError', { value: driverErrorOverride });
  }
  return error;
}

describe('CompleteOnboardingService', () => {
  let currentDraft: OnboardingDraft | null;
  let property: PropertyUnit | null;
  let overlap: boolean;
  let draftQuery: {
    setLock: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getOne: jest.Mock;
  };
  let overlapQuery: {
    where: jest.Mock;
    andWhere: jest.Mock;
    getExists: jest.Mock;
  };
  let manager: EntityManager;
  let save: jest.Mock;
  let transaction: jest.Mock;
  let repository: Repository<OnboardingDraft>;
  let promoteDraftPhotoToTenant: jest.Mock;
  let deleteObject: jest.Mock;
  let storage: StorageService;
  let service: CompleteOnboardingService;

  beforeEach(() => {
    currentDraft = draft();
    property = Object.assign(PropertyUnit.create('Centro', UnitType.APARTMENT, '101-A'), {
      id: PROPERTY_ID,
    });
    overlap = false;
    draftQuery = {
      setLock: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      getOne: jest.fn(() => Promise.resolve(currentDraft)),
    };
    draftQuery.setLock.mockReturnValue(draftQuery);
    draftQuery.where.mockReturnValue(draftQuery);
    draftQuery.andWhere.mockReturnValue(draftQuery);
    overlapQuery = {
      where: jest.fn(),
      andWhere: jest.fn(),
      getExists: jest.fn(() => Promise.resolve(overlap)),
    };
    overlapQuery.where.mockReturnValue(overlapQuery);
    overlapQuery.andWhere.mockReturnValue(overlapQuery);
    const onboardingRepository = { createQueryBuilder: jest.fn(() => draftQuery) };
    const propertyRepository = { findOneBy: jest.fn(() => Promise.resolve(property)) };
    const contractRepository = { createQueryBuilder: jest.fn(() => overlapQuery) };
    save = jest.fn().mockImplementation((entity: unknown) => {
      if (entity instanceof Tenant && !entity.id) {
        Object.defineProperty(entity, 'id', { value: TENANT_ID, configurable: true });
      }
      if (entity instanceof Contract && !entity.id) {
        Object.defineProperty(entity, 'id', { value: CONTRACT_ID, configurable: true });
      }
      if (entity instanceof Invoice && !entity.id) {
        Object.defineProperty(entity, 'id', { value: INVOICE_ID, configurable: true });
      }
      return Promise.resolve(entity);
    });
    manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === OnboardingDraft) return onboardingRepository;
        if (entity === PropertyUnit) return propertyRepository;
        if (entity === Contract) return contractRepository;
        throw new Error('unexpected repository');
      }),
      save,
    } as unknown as EntityManager;
    transaction = jest.fn((operation: (value: EntityManager) => Promise<unknown>) =>
      operation(manager),
    );
    repository = { manager: { transaction } } as unknown as Repository<OnboardingDraft>;
    promoteDraftPhotoToTenant = jest
      .fn()
      .mockResolvedValue({ bucket: 'bucket', key: PROMOTED_PHOTO_KEY });
    deleteObject = jest.fn().mockResolvedValue(undefined);
    storage = { promoteDraftPhotoToTenant, deleteObject } as unknown as StorageService;
    service = new CompleteOnboardingService(repository, storage);
  });

  it('atomically creates tenant, references, monthly contract and initial invoice', async () => {
    const result = await service.complete(DRAFT_ID, USER_ID, false);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(draftQuery.setLock.mock.calls).toContainEqual(['pessimistic_write']);
    expect(draftQuery.where.mock.calls).toContainEqual([
      'draft.id = :draftId',
      { draftId: DRAFT_ID },
    ]);
    expect(draftQuery.andWhere.mock.calls).toContainEqual([
      'draft.created_by = :actorId',
      { actorId: USER_ID },
    ]);
    expect(overlapQuery.andWhere.mock.calls).toContainEqual([
      'contract.status NOT IN (:...terminalStatuses)',
      { terminalStatuses: [ContractStatus.TERMINATED, ContractStatus.CANCELLED] },
    ]);
    expect(result).toEqual({
      draftId: DRAFT_ID,
      tenantId: TENANT_ID,
      contractId: CONTRACT_ID,
      invoiceId: INVOICE_ID,
      status: OnboardingDraftStatus.COMPLETED,
    });

    const savedValues = save.mock.calls.map(([value]) => value as unknown);
    const tenant = savedValues.find((value) => value instanceof Tenant) as Tenant;
    const references = savedValues.find(
      (value) => Array.isArray(value) && value.every((entry) => entry instanceof TenantReference),
    ) as TenantReference[];
    const contract = savedValues.find((value) => value instanceof Contract) as Contract;
    const invoice = savedValues.find((value) => value instanceof Invoice) as Invoice;
    expect(tenant).toMatchObject({
      id: TENANT_ID,
      name: 'Maria da Silva',
      cpf: '52998224725',
      email: 'maria@example.com',
    });
    expect(references).toHaveLength(3);
    expect(references.map((reference) => reference.email)).toEqual([
      'joao@example.com',
      null,
      null,
    ]);
    expect(references.every((reference) => reference.tenantId === TENANT_ID)).toBe(true);
    expect(contract).toMatchObject({
      id: CONTRACT_ID,
      tenantId: TENANT_ID,
      propertyUnitId: PROPERTY_ID,
      contractType: ContractType.MONTH_TO_MONTH,
      status: ContractStatus.PENDING_SIGNATURE,
      moveInDate: '2026-07-18',
      endDate: null,
      monthlyBaseValueCents: 185_000,
    });
    expect(invoice).toMatchObject({
      id: INVOICE_ID,
      contractId: CONTRACT_ID,
      competence: '2026-07',
      totalValueCents: 185_000,
      dueDate: '2026-07-18',
      periodStart: '2026-07-18',
      periodEnd: '2026-08-17',
    });
    expect(currentDraft?.status).toBe(OnboardingDraftStatus.COMPLETED);
    expect(savedValues.at(-1)).toBe(currentDraft);
  });

  it('promotes the draft photo to the new tenant and cleans up the draft object', async () => {
    currentDraft = draft();
    currentDraft.photoStorageKey = DRAFT_PHOTO_KEY;

    const result = await service.complete(DRAFT_ID, USER_ID, false);

    expect(promoteDraftPhotoToTenant).toHaveBeenCalledWith(DRAFT_PHOTO_KEY, TENANT_ID);
    const savedValues = save.mock.calls.map(([value]) => value as unknown);
    const tenantSaves = savedValues.filter((value) => value instanceof Tenant);
    expect(tenantSaves.at(-1)?.photoStorageKey).toBe(PROMOTED_PHOTO_KEY);
    expect(result.tenantId).toBe(TENANT_ID);
    expect(deleteObject).toHaveBeenCalledWith(DRAFT_PHOTO_KEY);
  });

  it('keeps the completion successful even if cleaning up the draft photo object fails', async () => {
    currentDraft = draft();
    currentDraft.photoStorageKey = DRAFT_PHOTO_KEY;
    deleteObject.mockRejectedValueOnce(new Error('storage unavailable'));

    const result = await service.complete(DRAFT_ID, USER_ID, false);

    expect(result.tenantId).toBe(TENANT_ID);
    expect(deleteObject).toHaveBeenCalledWith(DRAFT_PHOTO_KEY);
  });

  it('completes without a photo when the draft never had one', async () => {
    await service.complete(DRAFT_ID, USER_ID, false);

    expect(promoteDraftPhotoToTenant).not.toHaveBeenCalled();
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it('removes the promoted photo object if the transaction fails after promotion', async () => {
    currentDraft = draft();
    currentDraft.photoStorageKey = DRAFT_PHOTO_KEY;
    const invoiceSaveError = new Error('invoice persistence failed');
    save.mockImplementation((entity: unknown) => {
      if (entity instanceof Invoice) return Promise.reject(invoiceSaveError);
      if (entity instanceof Tenant && !entity.id) {
        Object.defineProperty(entity, 'id', { value: TENANT_ID, configurable: true });
      }
      if (entity instanceof Contract && !entity.id) {
        Object.defineProperty(entity, 'id', { value: CONTRACT_ID, configurable: true });
      }
      return Promise.resolve(entity);
    });

    await expect(service.complete(DRAFT_ID, USER_ID, false)).rejects.toBe(invoiceSaveError);

    expect(deleteObject).toHaveBeenCalledWith(PROMOTED_PHOTO_KEY);
    expect(deleteObject).not.toHaveBeenCalledWith(DRAFT_PHOTO_KEY);
  });

  it('preserves the original error even if cleaning up the promoted photo object fails', async () => {
    currentDraft = draft();
    currentDraft.photoStorageKey = DRAFT_PHOTO_KEY;
    const invoiceSaveError = new Error('invoice persistence failed');
    save.mockImplementation((entity: unknown) => {
      if (entity instanceof Invoice) return Promise.reject(invoiceSaveError);
      if (entity instanceof Tenant && !entity.id) {
        Object.defineProperty(entity, 'id', { value: TENANT_ID, configurable: true });
      }
      if (entity instanceof Contract && !entity.id) {
        Object.defineProperty(entity, 'id', { value: CONTRACT_ID, configurable: true });
      }
      return Promise.resolve(entity);
    });
    deleteObject.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(service.complete(DRAFT_ID, USER_ID, false)).rejects.toBe(invoiceSaveError);

    expect(deleteObject).toHaveBeenCalledWith(PROMOTED_PHOTO_KEY);
  });

  it('leaves the draft uncompleted and skips cleanup when the promotion call itself fails', async () => {
    currentDraft = draft();
    currentDraft.photoStorageKey = DRAFT_PHOTO_KEY;
    const promotionError = new Error('storage unavailable');
    promoteDraftPhotoToTenant.mockRejectedValueOnce(promotionError);

    await expect(service.complete(DRAFT_ID, USER_ID, false)).rejects.toBe(promotionError);

    expect(deleteObject).not.toHaveBeenCalled();
    const savedValues = save.mock.calls.map(([value]) => value as unknown);
    expect(savedValues.some((value) => value instanceof Contract)).toBe(false);
    expect(savedValues.some((value) => value instanceof Invoice)).toBe(false);
    expect(currentDraft?.status).toBe(OnboardingDraftStatus.DRAFT);
  });

  it('allows an admin to complete another user draft', async () => {
    await service.complete(DRAFT_ID, 'e5c1163a-8151-41e3-b953-350cb36435b1', true);
    expect(draftQuery.andWhere.mock.calls).toContainEqual([
      'TRUE',
      { actorId: 'e5c1163a-8151-41e3-b953-350cb36435b1' },
    ]);
  });

  it('clamps the initial due date to a move-in after the monthly billing day', async () => {
    currentDraft = draft({ ...payload(), moveInDate: '2026-07-31' });

    await service.complete(DRAFT_ID, USER_ID, false);

    const invoice = save.mock.calls
      .map(([value]) => value as unknown)
      .find((value) => value instanceof Invoice) as Invoice;
    expect(invoice).toMatchObject({
      dueDate: '2026-07-31',
      periodStart: '2026-07-31',
      periodEnd: '2026-08-30',
    });
  });

  it('returns not found for a missing or inaccessible draft', async () => {
    currentDraft = null;
    await expect(service.complete(DRAFT_ID, USER_ID, false)).rejects.toEqual(
      new NotFoundException('Rascunho de onboarding não encontrado.'),
    );
    expect(save).not.toHaveBeenCalled();
  });

  it.each([OnboardingDraftStatus.COMPLETED, OnboardingDraftStatus.DISCARDED])(
    'rejects a draft in %s state',
    async (status) => {
      currentDraft = draft();
      currentDraft.status = status;
      await expect(service.complete(DRAFT_ID, USER_ID, false)).rejects.toEqual(
        new ConflictException('O rascunho já foi concluído ou descartado.'),
      );
    },
  );

  it('rejects a missing property before persistence', async () => {
    property = null;
    await expect(service.complete(DRAFT_ID, USER_ID, false)).rejects.toEqual(
      new NotFoundException('Unidade imobiliária não encontrada.'),
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects a pre-existing contract overlap', async () => {
    overlap = true;
    await expect(service.complete(DRAFT_ID, USER_ID, false)).rejects.toEqual(
      new ConflictException('A unidade já possui um contrato sobreposto.'),
    );
    expect(save).not.toHaveBeenCalled();
  });

  it.each([
    ['not an object', null],
    ['an array', []],
    ['unsupported version', { ...payload(), version: 2 }],
    ['invalid personal data object', { ...payload(), personalData: null }],
    [
      'invalid civil status',
      {
        ...payload(),
        personalData: { ...(payload().personalData as object), civilStatus: 'UNKNOWN' },
      },
    ],
    ['non-array references', { ...payload(), references: {} }],
    ['fewer than two references', { ...payload(), references: [{}] }],
    ['fractional monthly value', { ...payload(), monthlyBaseValueCents: 1.5 }],
    ['zero monthly value', { ...payload(), monthlyBaseValueCents: 0 }],
    ['unsafe monthly value', { ...payload(), monthlyBaseValueCents: Number.MAX_SAFE_INTEGER + 1 }],
    ['non-string required field', { ...payload(), propertyUnitId: 123 }],
    ['blank required field', { ...payload(), moveInDate: '   ' }],
    ['invalid reference object', { ...payload(), references: [null, {}] }],
  ])('rejects payload with %s', async (_scenario, invalidPayload) => {
    currentDraft = draft(invalidPayload);
    await expect(service.complete(DRAFT_ID, USER_ID, false)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it.each([
    ['23505', 'CPF, e-mail ou telefone já cadastrado.'],
    ['23P01', 'A unidade já possui um contrato sobreposto.'],
  ])('maps PostgreSQL %s to a friendly conflict', async (code, message) => {
    transaction.mockRejectedValue(queryFailure(code));
    await expect(service.complete(DRAFT_ID, USER_ID, false)).rejects.toEqual(
      new ConflictException(message),
    );
  });

  it('preserves unrelated database and application errors', async () => {
    const foreignKey = queryFailure('23503');
    transaction.mockRejectedValueOnce(foreignKey);
    await expect(service.complete(DRAFT_ID, USER_ID, false)).rejects.toBe(foreignKey);

    const malformedDriverError = queryFailure('unused', null);
    transaction.mockRejectedValueOnce(malformedDriverError);
    await expect(service.complete(DRAFT_ID, USER_ID, false)).rejects.toBe(malformedDriverError);

    const missingCode = queryFailure('unused', {});
    transaction.mockRejectedValueOnce(missingCode);
    await expect(service.complete(DRAFT_ID, USER_ID, false)).rejects.toBe(missingCode);

    const applicationError = new Error('unexpected');
    transaction.mockRejectedValueOnce(applicationError);
    await expect(service.complete(DRAFT_ID, USER_ID, false)).rejects.toBe(applicationError);
  });
});
