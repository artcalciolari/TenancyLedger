import { Repository, SelectQueryBuilder } from 'typeorm';
import { Tenant, TenantCivilStatus } from '../../domain/entities/tenant.entity';
import { TenantQueries, TenantView } from './tenant.queries';

describe('TenantQueries', () => {
  let repository: jest.Mocked<Repository<Tenant>>;
  let queryBuilder: jest.Mocked<SelectQueryBuilder<Tenant>>;
  let queries: TenantQueries;

  const tenantView: TenantView = {
    id: '9465500e-0a06-452a-b1a8-9a3b117f3af0',
    cpf: '52998224725',
    profession: 'Engenheira',
    civilStatus: TenantCivilStatus.SINGLE,
    email: 'maria@example.com',
    mobilePhone: '11987654321',
  };

  beforeEach(() => {
    queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
      getRawOne: jest.fn(),
      getCount: jest.fn(),
      andWhere: jest.fn().mockReturnThis(),
    } as unknown as jest.Mocked<SelectQueryBuilder<Tenant>>;
    repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as unknown as jest.Mocked<Repository<Tenant>>;
    queries = new TenantQueries(repository);
  });

  it('seleciona somente aliases públicos e pagina em ordem determinística', async () => {
    queryBuilder.getRawMany.mockResolvedValue([tenantView]);
    queryBuilder.getCount.mockResolvedValue(23);

    await expect(queries.findAll({ page: 3, limit: 10 })).resolves.toEqual({
      data: [tenantView],
      total: 23,
      page: 3,
      limit: 10,
    });

    expect(repository.createQueryBuilder.mock.calls).toEqual([['tenant'], ['tenant']]);
    expect(queryBuilder.select.mock.calls).toEqual([['tenant.id', 'id']]);
    expect(queryBuilder.addSelect.mock.calls).toEqual([
      ['tenant.cpf', 'cpf'],
      ['tenant.profession', 'profession'],
      ['tenant.civilStatus', 'civilStatus'],
      ['tenant.email', 'email'],
      ['tenant.mobilePhone', 'mobilePhone'],
    ]);
    expect(queryBuilder.orderBy.mock.calls).toEqual([['tenant.createdAt', 'DESC']]);
    expect(queryBuilder.addOrderBy.mock.calls).toEqual([['tenant.id', 'ASC']]);
    expect(queryBuilder.offset.mock.calls).toEqual([[20]]);
    expect(queryBuilder.limit.mock.calls).toEqual([[10]]);
    expect(queryBuilder.getRawMany.mock.calls).toHaveLength(1);
    expect(queryBuilder.getCount.mock.calls).toHaveLength(1);
  });

  it('retorna o tenant encontrado por id usando os mesmos aliases públicos', async () => {
    queryBuilder.getRawOne.mockResolvedValue(tenantView);

    await expect(queries.findById(tenantView.id)).resolves.toEqual(tenantView);

    expect(queryBuilder.where.mock.calls).toEqual([['tenant.id = :id', { id: tenantView.id }]]);
    expect(queryBuilder.getRawOne.mock.calls).toHaveLength(1);
    expect(queryBuilder.addSelect.mock.calls).toContainEqual(['tenant.mobilePhone', 'mobilePhone']);
  });

  it('normaliza resultado ausente de findById para null', async () => {
    queryBuilder.getRawOne.mockResolvedValue(undefined);

    await expect(queries.findById('missing-id')).resolves.toBeNull();

    expect(queryBuilder.where.mock.calls).toEqual([['tenant.id = :id', { id: 'missing-id' }]]);
  });
});
