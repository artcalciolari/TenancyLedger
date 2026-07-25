import { Repository } from 'typeorm';
import { Building } from '../domain/building.entity';
import { BuildingTypeOrmRepository } from './building.typeorm.repository';

describe('BuildingTypeOrmRepository', () => {
  it('persists the building', async () => {
    const building = Building.create('Edifício Aurora', 'Bela Vista');
    Object.defineProperty(building, 'id', {
      value: '3d6f0c9e-3c9a-4d3b-9d0a-8f6e5c1a2b3c',
    });
    const save = jest.fn().mockResolvedValue(building);
    const typeOrmRepository = { save } as unknown as Repository<Building>;
    const repository = new BuildingTypeOrmRepository(typeOrmRepository);

    await expect(repository.save(building)).resolves.toBe(building);
    expect(save).toHaveBeenCalledWith(building);
  });

  it('preserves the aggregate total when a filtered page has no rows', async () => {
    const aggregate = {} as Record<string, jest.Mock>;
    for (const method of [
      'leftJoin',
      'select',
      'addSelect',
      'groupBy',
      'having',
      'orderBy',
      'addOrderBy',
      'offset',
      'limit',
    ]) {
      aggregate[method] = jest.fn().mockReturnValue(aggregate);
    }
    const countSource = {
      getQuery: jest.fn().mockReturnValue('SELECT grouped buildings'),
      getParameters: jest.fn().mockReturnValue({ asOf: '2026-07-20' }),
    };
    aggregate.clone = jest.fn().mockReturnValue(countSource);
    aggregate.getRawMany = jest.fn().mockResolvedValue([]);

    const countQuery = {} as Record<string, jest.Mock>;
    for (const method of ['select', 'from', 'setParameters']) {
      countQuery[method] = jest.fn().mockReturnValue(countQuery);
    }
    countQuery.getRawOne = jest.fn().mockResolvedValue({ total: '7' });

    const typeOrmRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(aggregate),
      manager: {
        createQueryBuilder: jest.fn().mockReturnValue(countQuery),
      },
    } as unknown as Repository<Building>;
    const repository = new BuildingTypeOrmRepository(typeOrmRepository);

    await expect(
      repository.list({
        page: 3,
        limit: 10,
        asOf: '2026-07-20',
        vacancy: 'WITH_VACANCY',
      }),
    ).resolves.toEqual({ items: [], total: 7 });

    expect(aggregate.having).toHaveBeenCalledWith(
      'COUNT(DISTINCT room.id) > COUNT(DISTINCT contract.room_id)',
    );
    expect(aggregate.orderBy).toHaveBeenCalledWith(
      expect.stringContaining('WHEN COUNT(DISTINCT room.id) = 0 THEN NULL'),
      'DESC',
      'NULLS LAST',
    );
    expect(aggregate.addOrderBy).toHaveBeenNthCalledWith(1, 'lower(building.name)', 'ASC');
    expect(aggregate.addOrderBy).toHaveBeenNthCalledWith(2, 'building.id', 'ASC');
    expect(aggregate.offset).toHaveBeenCalledWith(20);
    expect(countQuery.from).toHaveBeenCalledWith(
      '(SELECT grouped buildings)',
      'filtered_buildings',
    );
  });
});
