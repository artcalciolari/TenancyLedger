import { NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ValidationError } from '../../../../core/domain/errors/validation.error';
import { Tenant, TenantCivilStatus } from '../../domain/entities/tenant.entity';
import { TenantAlreadyExistsError } from '../../domain/errors/tenant-already-exists.error';
import type { ITenantRepository } from '../../domain/repositories/tenant.repository';
import { UpdateTenantUseCase } from './update-tenant.use-case';

const TENANT_ID = '9465500e-0a06-452a-b1a8-9a3b117f3af0';
const OTHER_TENANT_ID = 'f14f0701-daad-478c-a7ac-5ccb6b96a6af';

function persistedTenant(id = TENANT_ID): Tenant {
  const tenant = Tenant.create(
    'Maria da Silva',
    '52998224725',
    '123456789',
    'Engenheira',
    TenantCivilStatus.SINGLE,
    'maria@example.com',
    '11987654321',
  );
  tenant.id = id;
  return tenant;
}

function queryFailure(code: string): QueryFailedError {
  const driverError = Object.assign(new Error(`PostgreSQL ${code}`), { code });
  return new QueryFailedError('UPDATE tenants', [], driverError);
}

describe('UpdateTenantUseCase', () => {
  let repository: jest.Mocked<ITenantRepository>;
  let useCase: UpdateTenantUseCase;

  beforeEach(() => {
    repository = {
      save: jest.fn().mockResolvedValue(undefined),
      findByCpf: jest.fn().mockResolvedValue(null),
      findByEmail: jest.fn().mockResolvedValue(null),
      findByMobilePhone: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(persistedTenant()),
    };
    useCase = new UpdateTenantUseCase(repository);
  });

  it('updates and normalizes editable profile fields', async () => {
    const result = await useCase.execute(TENANT_ID, {
      cpf: undefined,
      rg: undefined,
      name: ' Maria   Souza ',
      profession: ' Arquiteta ',
      civilStatus: TenantCivilStatus.MARRIED,
      email: ' MARIA.SOUZA@EXAMPLE.COM ',
      mobilePhone: '+55 11 99876-5432',
    });

    expect(result).toMatchObject({
      id: TENANT_ID,
      name: 'Maria Souza',
      cpf: '52998224725',
      rg: '123456789',
      profession: 'Arquiteta',
      civilStatus: TenantCivilStatus.MARRIED,
      email: 'maria.souza@example.com',
      mobilePhone: '11998765432',
    });
    expect(repository.findByEmail.mock.calls).toEqual([['maria.souza@example.com']]);
    expect(repository.findByMobilePhone.mock.calls).toEqual([['11998765432']]);
    expect(repository.save.mock.calls).toEqual([[result]]);
  });

  it('rejects an unknown tenant', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(useCase.execute(TENANT_ID, { name: 'Maria Souza' })).rejects.toThrow(
      new NotFoundException('Locatário não encontrado.'),
    );
    expect(repository.save.mock.calls).toHaveLength(0);
  });

  it.each([{ cpf: '11144477735' }, { rg: '987654321' }])(
    'rejects immutable identity fields with validation error',
    async (identityField) => {
      await expect(useCase.execute(TENANT_ID, identityField)).rejects.toThrow(
        new ValidationError('CPF e RG são imutáveis.'),
      );
      expect(repository.save.mock.calls).toHaveLength(0);
    },
  );

  it('rejects an email owned by another tenant', async () => {
    repository.findByEmail.mockResolvedValue(persistedTenant(OTHER_TENANT_ID));

    await expect(useCase.execute(TENANT_ID, { email: 'other@example.com' })).rejects.toThrow(
      new TenantAlreadyExistsError('Já existe um locatário com este e-mail ou telefone.'),
    );
    expect(repository.save.mock.calls).toHaveLength(0);
  });

  it('allows the tenant to retain its own email and phone', async () => {
    const tenant = persistedTenant();
    repository.findById.mockResolvedValue(tenant);
    repository.findByEmail.mockResolvedValue(tenant);
    repository.findByMobilePhone.mockResolvedValue(tenant);

    await expect(useCase.execute(TENANT_ID, {})).resolves.toBe(tenant);
    expect(repository.save.mock.calls).toEqual([[tenant]]);
  });

  it('maps a concurrent unique violation to a conflict', async () => {
    repository.save.mockRejectedValue(queryFailure('23505'));

    await expect(useCase.execute(TENANT_ID, { email: 'novo@example.com' })).rejects.toThrow(
      new TenantAlreadyExistsError('Já existe um locatário com este e-mail ou telefone.'),
    );
  });
});
