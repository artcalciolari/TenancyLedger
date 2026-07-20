import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { TenantReference } from '../../domain/entities/tenant-reference.entity';
import { Tenant, TenantCivilStatus } from '../../domain/entities/tenant.entity';
import type { ITenantRepository } from '../../domain/repositories/tenant.repository';
import { TenantReferencesUseCase } from './tenant-references.use-case';

const TENANT_ID = '9465500e-0a06-452a-b1a8-9a3b117f3af0';
const REFERENCE_ID = 'dad91a88-583f-4b2a-9ac6-0d8eb14cd266';
const USER_ID = '7fdf9cde-2961-4ed2-a3ae-eedce12a42ee';

function tenant(): Tenant {
  return Object.assign(
    Tenant.create(
      'Maria da Silva',
      '52998224725',
      '123456789',
      'Engenheira',
      TenantCivilStatus.SINGLE,
      'maria@example.com',
      '11987654321',
    ),
    { id: TENANT_ID },
  );
}

function reference(): TenantReference {
  return Object.assign(
    TenantReference.create(TENANT_ID, {
      name: 'João da Silva',
      relationship: 'Irmão',
      phone: '11987654321',
    }),
    { id: REFERENCE_ID, createdAt: new Date(), updatedAt: new Date() },
  );
}

describe('TenantReferencesUseCase', () => {
  let references: jest.Mocked<Repository<TenantReference>>;
  let tenants: jest.Mocked<ITenantRepository>;
  let useCase: TenantReferencesUseCase;

  beforeEach(() => {
    references = {
      save: jest.fn((entry: TenantReference) => Promise.resolve(entry)),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn((entry: TenantReference) => Promise.resolve(entry)),
    } as unknown as jest.Mocked<Repository<TenantReference>>;
    tenants = {
      findById: jest.fn().mockResolvedValue(tenant()),
    } as unknown as jest.Mocked<ITenantRepository>;
    useCase = new TenantReferencesUseCase(references, tenants);
  });

  it('creates a normalized reference only for an existing tenant', async () => {
    const result = await useCase.create(TENANT_ID, {
      name: ' João da Silva ',
      relationship: ' Irmão ',
      phone: '+55 11 98765-4321',
    });

    expect(result).toMatchObject({
      tenantId: TENANT_ID,
      name: 'João da Silva',
      phone: '11987654321',
    });
    expect(references.save.mock.calls).toContainEqual([result]);
  });

  it.each(['create', 'list'] as const)('rejects %s for an unknown tenant', async (operation) => {
    tenants.findById.mockResolvedValue(null);
    const promise =
      operation === 'create'
        ? useCase.create(TENANT_ID, {
            name: 'João Silva',
            relationship: 'Irmão',
            phone: '11987654321',
          })
        : useCase.list(TENANT_ID);
    await expect(promise).rejects.toEqual(new NotFoundException('Locatário não encontrado.'));
  });

  it('lists references in deterministic creation order', async () => {
    references.find.mockResolvedValue([reference()]);
    await expect(useCase.list(TENANT_ID)).resolves.toHaveLength(1);
    expect(references.find.mock.calls).toContainEqual([
      {
        where: { tenantId: TENANT_ID },
        order: { createdAt: 'ASC', id: 'ASC' },
      },
    ]);
  });

  it('gets a reference scoped to its tenant', async () => {
    const current = reference();
    references.findOne.mockResolvedValue(current);
    await expect(useCase.get(TENANT_ID, REFERENCE_ID)).resolves.toBe(current);
    expect(references.findOne.mock.calls).toContainEqual([
      { where: { id: REFERENCE_ID, tenantId: TENANT_ID } },
    ]);
  });

  it('hides a missing or cross-tenant reference', async () => {
    references.findOne.mockResolvedValue(null);
    await expect(useCase.get(TENANT_ID, REFERENCE_ID)).rejects.toEqual(
      new NotFoundException('Referência do locatário não encontrada.'),
    );
  });

  it('updates a reference through its domain rules', async () => {
    const current = reference();
    references.findOne.mockResolvedValue(current);
    const result = await useCase.update(TENANT_ID, REFERENCE_ID, { notes: 'Confirmada.' });
    expect(result.notes).toBe('Confirmada.');
    expect(references.save.mock.calls).toContainEqual([current]);
  });

  it('removes a scoped reference', async () => {
    const current = reference();
    references.findOne.mockResolvedValue(current);
    await useCase.remove(TENANT_ID, REFERENCE_ID);
    expect(references.remove.mock.calls).toContainEqual([current]);
  });

  it('records who verified the reference', async () => {
    const current = reference();
    references.findOne.mockResolvedValue(current);
    const result = await useCase.verify(TENANT_ID, REFERENCE_ID, USER_ID);
    expect(result.verifiedByUserId).toBe(USER_ID);
    expect(result.verifiedAt).toBeInstanceOf(Date);
    expect(references.save.mock.calls).toContainEqual([current]);
  });
});
