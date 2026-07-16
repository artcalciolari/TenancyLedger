import { Repository } from 'typeorm';
import { Tenant, TenantCivilStatus } from '../../domain/entities/tenant.entity';
import { TenantTypeOrmRepository } from './tenant.typeorm.repository';

describe('TenantTypeOrmRepository', () => {
  let typeOrmRepository: jest.Mocked<Repository<Tenant>>;
  let repository: TenantTypeOrmRepository;
  let tenant: Tenant;

  beforeEach(() => {
    typeOrmRepository = {
      save: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<Tenant>>;
    repository = new TenantTypeOrmRepository(typeOrmRepository);
    tenant = Tenant.create(
      'Maria da Silva',
      '52998224725',
      '123456789',
      'Engenheira',
      TenantCivilStatus.SINGLE,
      'maria@example.com',
      '11987654321',
    );
    tenant.id = '9465500e-0a06-452a-b1a8-9a3b117f3af0';
  });

  it('delega a persistência ao repositório TypeORM', async () => {
    typeOrmRepository.save.mockResolvedValue(tenant);

    await expect(repository.save(tenant)).resolves.toBeUndefined();

    expect(typeOrmRepository.save.mock.calls).toEqual([[tenant]]);
  });

  it.each([
    ['id', 'findById', '9465500e-0a06-452a-b1a8-9a3b117f3af0'],
    ['cpf', 'findByCpf', '52998224725'],
    ['email', 'findByEmail', 'maria@example.com'],
    ['mobilePhone', 'findByMobilePhone', '11987654321'],
  ] as const)(
    'consulta por %s usando o nome público correto da entidade',
    async (field, method, value) => {
      typeOrmRepository.findOne.mockResolvedValue(tenant);

      await expect(repository[method](value)).resolves.toBe(tenant);

      expect(typeOrmRepository.findOne.mock.calls).toEqual([[{ where: { [field]: value } }]]);
    },
  );

  it('preserva null quando o TypeORM não encontra o tenant', async () => {
    typeOrmRepository.findOne.mockResolvedValue(null);

    await expect(repository.findByCpf('00000000000')).resolves.toBeNull();
  });
});
