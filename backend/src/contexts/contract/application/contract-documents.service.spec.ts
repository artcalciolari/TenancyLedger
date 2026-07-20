import { ConflictException, NotFoundException } from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';
import type { StorageService } from '../../../infrastructure/storage.service';
import { PropertyUnit, UnitType } from '../../property/domain/property-unit.entity';
import { Tenant } from '../../tenant/domain/entities/tenant.entity';
import {
  ContractDocument,
  ContractDocumentKind,
} from '../domain/entities/contract-document.entity';
import { Contract, ContractStatus } from '../domain/entities/contract.entity';
import type { ContractDocumentRenderer } from '../infrastructure/contract-document.renderer';
import { ContractDocumentsService } from './contract-documents.service';

const CONTRACT_ID = '4d4d05b6-b5db-47c7-91fc-b0c86c036d9f';
const TENANT_ID = '48bb503a-4d2a-4f56-88eb-6f7a9436ec67';
const PROPERTY_ID = 'c2926b25-4e17-44a8-8097-9c093f842cbb';
const USER_ID = '957a3866-f282-48d7-9180-5cbf99c74982';
const DOCUMENT_ID = 'df248760-6617-4dae-a7f2-3e80d7eac89a';
const CREATED_AT = new Date('2026-07-18T15:30:00.000Z');

function assignId(target: object, id: string): void {
  Object.defineProperty(target, 'id', { value: id, configurable: true });
}

function pendingContract(): Contract {
  const contract = Contract.createPendingSignature(TENANT_ID, PROPERTY_ID, '2026-07-18', 185_000);
  assignId(contract, CONTRACT_ID);
  return contract;
}

function fixedContract(): Contract {
  const contract = Contract.create(TENANT_ID, PROPERTY_ID, '2026-07-18', 185_000, 12, true);
  assignId(contract, CONTRACT_ID);
  return contract;
}

function persistedDocument(overrides: Partial<ContractDocument> = {}): ContractDocument {
  return Object.assign(new ContractDocument(), {
    id: DOCUMENT_ID,
    contractId: CONTRACT_ID,
    kind: ContractDocumentKind.SIGNED,
    version: 1,
    storageKey: `documents/contract-documents/${DOCUMENT_ID}/document.pdf`,
    originalName: 'signed.pdf',
    contentType: 'application/pdf',
    uploadedByUserId: USER_ID,
    createdAt: CREATED_AT,
    ...overrides,
  });
}

describe('ContractDocumentsService', () => {
  let documents: jest.Mocked<Pick<Repository<ContractDocument>, 'find' | 'findOne'>> & {
    manager: Pick<EntityManager, 'transaction'>;
  };
  let contracts: jest.Mocked<Pick<Repository<Contract>, 'findOneBy' | 'existsBy'>>;
  let tenants: jest.Mocked<Pick<Repository<Tenant>, 'findOneBy'>>;
  let properties: jest.Mocked<Pick<Repository<PropertyUnit>, 'findOneBy'>>;
  let transaction: jest.Mock;
  let manager: EntityManager;
  let transactionalContractFind: jest.Mock;
  let rawVersion: jest.Mock;
  let managerSave: jest.Mock;
  let managerQuery: jest.Mock;
  let uploadDocument: jest.Mock;
  let createDocumentReadUrl: jest.Mock;
  let deleteObject: jest.Mock;
  let render: jest.Mock;
  let service: ContractDocumentsService;
  let contract: Contract;

  beforeEach(() => {
    contract = pendingContract();
    transactionalContractFind = jest.fn().mockResolvedValue(contract);
    rawVersion = jest.fn().mockResolvedValue(undefined);
    const queryBuilder = {
      select: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      getRawOne: rawVersion,
    };
    queryBuilder.select.mockReturnValue(queryBuilder);
    queryBuilder.where.mockReturnValue(queryBuilder);
    queryBuilder.andWhere.mockReturnValue(queryBuilder);
    const transactionalDocuments = { createQueryBuilder: jest.fn(() => queryBuilder) };
    const transactionalContracts = { findOne: transactionalContractFind };
    managerSave = jest.fn().mockImplementation((entity: unknown) => {
      if (entity instanceof ContractDocument && !entity.createdAt) {
        Object.defineProperty(entity, 'createdAt', { value: CREATED_AT, configurable: true });
      }
      return Promise.resolve(entity);
    });
    managerQuery = jest.fn().mockResolvedValue(undefined);
    manager = {
      query: managerQuery,
      save: managerSave,
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Contract) return transactionalContracts;
        if (entity === ContractDocument) return transactionalDocuments;
        throw new Error('unexpected repository');
      }),
    } as unknown as EntityManager;
    transaction = jest.fn((operation: (value: EntityManager) => Promise<unknown>) =>
      operation(manager),
    );
    documents = {
      manager: { transaction } as Pick<EntityManager, 'transaction'>,
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    contracts = {
      findOneBy: jest.fn().mockResolvedValue(contract),
      existsBy: jest.fn().mockResolvedValue(true),
    };
    tenants = {
      findOneBy: jest.fn().mockResolvedValue({
        id: TENANT_ID,
        name: 'Maria da Silva',
        cpf: '52998224725',
        rg: '12.345.678-9',
      }),
    };
    properties = {
      findOneBy: jest.fn().mockResolvedValue({
        id: PROPERTY_ID,
        type: UnitType.APARTMENT,
        unitNumber: '101-A',
        neighborhood: 'Centro',
      }),
    };
    uploadDocument = jest.fn().mockImplementation(({ ownerId }: { ownerId: string }) =>
      Promise.resolve({
        bucket: 'private-bucket',
        key: `documents/contract-documents/${ownerId}/document.pdf`,
      }),
    );
    createDocumentReadUrl = jest
      .fn()
      .mockResolvedValue('https://storage.example/document?signature=test');
    deleteObject = jest.fn().mockResolvedValue(undefined);
    render = jest.fn().mockResolvedValue(Buffer.from('%PDF-contract'));
    service = new ContractDocumentsService(
      documents as unknown as Repository<ContractDocument>,
      contracts as unknown as Repository<Contract>,
      tenants as unknown as Repository<Tenant>,
      properties as unknown as Repository<PropertyUnit>,
      { uploadDocument, createDocumentReadUrl, deleteObject } as unknown as StorageService,
      { render } as unknown as ContractDocumentRenderer,
    );
  });

  it('renders a monthly preview using tenant, unit and calendar-period data', async () => {
    await expect(service.preview(CONTRACT_ID)).resolves.toEqual(Buffer.from('%PDF-contract'));
    expect(render.mock.calls).toContainEqual([
      {
        contractId: CONTRACT_ID,
        tenantName: 'Maria da Silva',
        tenantCpf: '52998224725',
        tenantRg: '12.345.678-9',
        propertyDescription: 'APARTMENT 101-A — Centro',
        monthlyValueCents: 185_000,
        moveInDate: '2026-07-18',
        firstPeriodEnd: '2026-08-17',
      },
    ]);
  });

  it('rejects preview for a fixed-term contract', async () => {
    contracts.findOneBy.mockResolvedValue(fixedContract());
    await expect(service.preview(CONTRACT_ID)).rejects.toEqual(
      new ConflictException('A prévia mensal está disponível apenas para contratos mensais.'),
    );
    expect(render).not.toHaveBeenCalled();
  });

  it('rejects preview for a missing contract', async () => {
    contracts.findOneBy.mockResolvedValue(null);
    await expect(service.preview(CONTRACT_ID)).rejects.toEqual(
      new NotFoundException('Contrato não encontrado.'),
    );
  });

  it.each(['tenant', 'property'] as const)(
    'rejects preview when the related %s is missing',
    async (relation) => {
      if (relation === 'tenant') tenants.findOneBy.mockResolvedValue(null);
      else properties.findOneBy.mockResolvedValue(null);
      await expect(service.preview(CONTRACT_ID)).rejects.toEqual(
        new NotFoundException('Relacionamentos do contrato não encontrados.'),
      );
    },
  );

  it('uploads the first signed version and marks a pending contract as signed', async () => {
    const result = await service.upload(CONTRACT_ID, {
      kind: ContractDocumentKind.SIGNED,
      originalName: 'signed.pdf',
      contentType: 'application/pdf',
      body: Buffer.from('%PDF-signed'),
      uploadedByUserId: USER_ID,
    });

    expect(managerQuery.mock.calls).toContainEqual([
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
      ['contract-document-version', CONTRACT_ID],
    ]);
    expect(result).toMatchObject({
      contractId: CONTRACT_ID,
      kind: ContractDocumentKind.SIGNED,
      version: 1,
      originalName: 'signed.pdf',
      contentType: 'application/pdf',
      uploadedByUserId: USER_ID,
      createdAt: CREATED_AT,
      url: 'https://storage.example/document?signature=test',
      expiresInSeconds: 300,
    });
    expect(uploadDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'contract-documents',
        ownerId: result.id,
        contentType: 'application/pdf',
        body: Buffer.from('%PDF-signed'),
      }),
    );
    expect(contract.status).toBe(ContractStatus.PAYMENT_PENDING);
    expect(managerSave.mock.calls.some(([entity]) => entity === contract)).toBe(true);
  });

  it('increments the signed version without repeating the status transition', async () => {
    contract.markSigned();
    rawVersion.mockResolvedValue({ version: '1' });

    const result = await service.upload(CONTRACT_ID, {
      kind: ContractDocumentKind.SIGNED,
      originalName: 'signed-v2.pdf',
      contentType: 'application/pdf',
      body: Buffer.from('%PDF-signed-v2'),
      uploadedByUserId: USER_ID,
    });

    expect(result.version).toBe(2);
    expect(managerSave.mock.calls.filter(([entity]) => entity === contract)).toHaveLength(0);
  });

  it('stores an OTHER document without transitioning a pending contract', async () => {
    const result = await service.upload(CONTRACT_ID, {
      kind: ContractDocumentKind.OTHER,
      originalName: 'vistoria.png',
      contentType: 'image/png',
      body: Buffer.from('png'),
      uploadedByUserId: USER_ID,
    });

    expect(result.kind).toBe(ContractDocumentKind.OTHER);
    expect(contract.status).toBe(ContractStatus.PENDING_SIGNATURE);
  });

  it('deletes an uploaded object if database persistence fails', async () => {
    const persistenceError = new Error('database unavailable');
    managerSave.mockImplementation((entity: unknown) => {
      if (entity instanceof ContractDocument) return Promise.reject(persistenceError);
      return Promise.resolve(entity);
    });

    await expect(
      service.upload(CONTRACT_ID, {
        kind: ContractDocumentKind.SIGNED,
        originalName: 'signed.pdf',
        contentType: 'application/pdf',
        body: Buffer.from('%PDF-signed'),
        uploadedByUserId: USER_ID,
      }),
    ).rejects.toBe(persistenceError);
    expect(deleteObject).toHaveBeenCalledTimes(1);
  });

  it('preserves the original error even if orphan cleanup fails', async () => {
    const persistenceError = new Error('database unavailable');
    managerSave.mockRejectedValue(persistenceError);
    deleteObject.mockRejectedValue(new Error('storage unavailable'));

    await expect(
      service.upload(CONTRACT_ID, {
        kind: ContractDocumentKind.OTHER,
        originalName: 'notes.pdf',
        contentType: 'application/pdf',
        body: Buffer.from('%PDF-notes'),
        uploadedByUserId: USER_ID,
      }),
    ).rejects.toBe(persistenceError);
  });

  it('does not run orphan cleanup when upload fails before storage', async () => {
    transactionalContractFind.mockResolvedValue(null);
    await expect(
      service.upload(CONTRACT_ID, {
        kind: ContractDocumentKind.SIGNED,
        originalName: 'signed.pdf',
        contentType: 'application/pdf',
        body: Buffer.from('%PDF-signed'),
        uploadedByUserId: USER_ID,
      }),
    ).rejects.toEqual(new NotFoundException('Contrato não encontrado.'));
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it('generates the first GENERATED version for a pending monthly contract', async () => {
    const result = await service.generate(CONTRACT_ID, USER_ID);

    expect(managerQuery.mock.calls).toContainEqual([
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
      ['contract-document-version', CONTRACT_ID],
    ]);
    expect(render.mock.calls).toContainEqual([
      {
        contractId: CONTRACT_ID,
        tenantName: 'Maria da Silva',
        tenantCpf: '52998224725',
        tenantRg: '12.345.678-9',
        propertyDescription: 'APARTMENT 101-A — Centro',
        monthlyValueCents: 185_000,
        moveInDate: '2026-07-18',
        firstPeriodEnd: '2026-08-17',
      },
    ]);
    expect(result).toMatchObject({
      contractId: CONTRACT_ID,
      kind: ContractDocumentKind.GENERATED,
      version: 1,
      contentType: 'application/pdf',
      uploadedByUserId: USER_ID,
      url: 'https://storage.example/document?signature=test',
    });
    expect(createDocumentReadUrl.mock.calls.at(-1)).toEqual([expect.any(String), 300, 'inline']);
    expect(uploadDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'contract-documents',
        contentType: 'application/pdf',
        body: Buffer.from('%PDF-contract'),
      }),
    );
  });

  it('increments the generated version on each call', async () => {
    rawVersion.mockResolvedValue({ version: '2' });

    const result = await service.generate(CONTRACT_ID, USER_ID);

    expect(result.version).toBe(3);
  });

  it('rejects generation for a fixed-term contract', async () => {
    transactionalContractFind.mockResolvedValue(fixedContract());

    await expect(service.generate(CONTRACT_ID, USER_ID)).rejects.toEqual(
      new ConflictException(
        'A geração de contrato está disponível apenas para contratos mensais pendentes de assinatura.',
      ),
    );
    expect(uploadDocument).not.toHaveBeenCalled();
  });

  it('rejects generation once the contract has moved past pending signature', async () => {
    contract.markSigned();
    transactionalContractFind.mockResolvedValue(contract);

    await expect(service.generate(CONTRACT_ID, USER_ID)).rejects.toEqual(
      new ConflictException(
        'A geração de contrato está disponível apenas para contratos mensais pendentes de assinatura.',
      ),
    );
    expect(uploadDocument).not.toHaveBeenCalled();
  });

  it('rejects generation for a missing contract without touching storage', async () => {
    transactionalContractFind.mockResolvedValue(null);

    await expect(service.generate(CONTRACT_ID, USER_ID)).rejects.toEqual(
      new NotFoundException('Contrato não encontrado.'),
    );
    expect(uploadDocument).not.toHaveBeenCalled();
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it.each(['tenant', 'property'] as const)(
    'rejects generation when the related %s is missing',
    async (relation) => {
      if (relation === 'tenant') tenants.findOneBy.mockResolvedValue(null);
      else properties.findOneBy.mockResolvedValue(null);

      await expect(service.generate(CONTRACT_ID, USER_ID)).rejects.toEqual(
        new NotFoundException('Relacionamentos do contrato não encontrados.'),
      );
      expect(uploadDocument).not.toHaveBeenCalled();
    },
  );

  it('deletes the orphaned generated object if persistence fails', async () => {
    const persistenceError = new Error('database unavailable');
    managerSave.mockImplementation((entity: unknown) => {
      if (entity instanceof ContractDocument) return Promise.reject(persistenceError);
      return Promise.resolve(entity);
    });

    await expect(service.generate(CONTRACT_ID, USER_ID)).rejects.toBe(persistenceError);
    expect(deleteObject).toHaveBeenCalledTimes(1);
  });

  it('preserves the original error even if orphan cleanup fails after generation', async () => {
    const persistenceError = new Error('database unavailable');
    managerSave.mockImplementation((entity: unknown) => {
      if (entity instanceof ContractDocument) return Promise.reject(persistenceError);
      return Promise.resolve(entity);
    });
    deleteObject.mockRejectedValue(new Error('storage unavailable'));

    await expect(service.generate(CONTRACT_ID, USER_ID)).rejects.toBe(persistenceError);
    expect(deleteObject).toHaveBeenCalledTimes(1);
  });

  it('lists every stored version with short-lived private URLs', async () => {
    const first = persistedDocument();
    const second = persistedDocument({
      id: '14fdb4ed-1caf-4f38-9699-fbe665b3f55d',
      version: 2,
      storageKey: 'documents/contract-documents/14fdb4ed-1caf-4f38-9699-fbe665b3f55d/document.pdf',
    });
    documents.find.mockResolvedValue([second, first]);

    const result = await service.list(CONTRACT_ID);

    expect(documents.find.mock.calls).toContainEqual([
      {
        where: { contractId: CONTRACT_ID },
        order: { createdAt: 'DESC', id: 'ASC' },
      },
    ]);
    expect(result.map((entry) => entry.version)).toEqual([2, 1]);
    expect(createDocumentReadUrl.mock.calls).toContainEqual([second.storageKey, 300, 'attachment']);
    expect(createDocumentReadUrl.mock.calls).toContainEqual([first.storageKey, 300, 'attachment']);
  });

  it('rejects history for a missing contract', async () => {
    contracts.existsBy.mockResolvedValue(false);
    await expect(service.list(CONTRACT_ID)).rejects.toEqual(
      new NotFoundException('Contrato não encontrado.'),
    );
    expect(documents.find).not.toHaveBeenCalled();
  });

  it('returns a private URL for a document scoped to its contract', async () => {
    const document = persistedDocument();
    documents.findOne.mockResolvedValue(document);

    await expect(service.getDownloadUrl(CONTRACT_ID, DOCUMENT_ID)).resolves.toEqual({
      url: 'https://storage.example/document?signature=test',
      expiresInSeconds: 300,
    });
    expect(documents.findOne.mock.calls).toContainEqual([
      { where: { id: DOCUMENT_ID, contractId: CONTRACT_ID } },
    ]);
  });

  it('rejects a missing contract document download', async () => {
    await expect(service.getDownloadUrl(CONTRACT_ID, DOCUMENT_ID)).rejects.toEqual(
      new NotFoundException('Documento do contrato não encontrado.'),
    );
  });
});
