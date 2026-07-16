import { QueryFailedError } from 'typeorm';
import { TenantCivilStatus } from '../../domain/entities/tenant.entity';
import { TenantAlreadyExistsError } from '../../domain/errors/tenant-already-exists.error';
import { ITenantRepository } from '../../domain/repositories/tenant.repository';
import { CreateTenantUseCase, CreateTenantInput } from './create-tenant.use-case';

describe('CreateTenantUseCase', () => {
  let repository: jest.Mocked<ITenantRepository>;
  let useCase: CreateTenantUseCase;

  const input: CreateTenantInput = {
    name: 'Maria da Silva',
    cpf: '529.982.247-25',
    rg: '12.345.678-9',
    profession: 'Engenheira',
    civilStatus: TenantCivilStatus.SINGLE,
    email: ' MARIA@EXAMPLE.COM ',
    mobilePhone: '+55 (11) 98765-4321',
  };

  beforeEach(() => {
    repository = {
      save: jest.fn(),
      findByCpf: jest.fn().mockResolvedValue(null),
      findByEmail: jest.fn().mockResolvedValue(null),
      findByMobilePhone: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(null),
    };
    useCase = new CreateTenantUseCase(repository);
  });

  it('normaliza identificadores antes das consultas e da persistência', async () => {
    const tenant = await useCase.execute(input);

    expect(repository.findByCpf.mock.calls).toContainEqual(['52998224725']);
    expect(repository.findByEmail.mock.calls).toContainEqual(['maria@example.com']);
    expect(repository.findByMobilePhone.mock.calls).toContainEqual(['11987654321']);
    expect(tenant).toMatchObject({
      cpf: '52998224725',
      email: 'maria@example.com',
      mobilePhone: '11987654321',
    });
    expect(repository.save.mock.calls).toContainEqual([tenant]);
  });

  it('rejeita duplicidade encontrada antes da gravação', async () => {
    repository.findByEmail.mockResolvedValue({} as never);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(TenantAlreadyExistsError);
    expect(repository.save.mock.calls).toHaveLength(0);
  });

  it('converte a violação única concorrente do PostgreSQL em conflito de domínio', async () => {
    const driverError = Object.assign(new Error('duplicate'), { code: '23505' });
    repository.save.mockRejectedValue(new QueryFailedError('INSERT', [], driverError));

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(TenantAlreadyExistsError);
  });
});
