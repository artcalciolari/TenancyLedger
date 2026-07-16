import { EntityManager, Repository } from 'typeorm';
import { Building } from '../domain/building.entity';
import { BuildingTypeOrmRepository } from './building.typeorm.repository';

describe('BuildingTypeOrmRepository', () => {
  it('persists the building and propagates its neighborhood in one transaction', async () => {
    const building = Building.create('Edifício Aurora', 'Bela Vista');
    Object.defineProperty(building, 'id', {
      value: '3d6f0c9e-3c9a-4d3b-9d0a-8f6e5c1a2b3c',
    });
    const transactionalSave = jest.fn().mockResolvedValue(building);
    const query = jest.fn().mockResolvedValue([[], 2]);
    const manager = {
      getRepository: jest.fn().mockReturnValue({ save: transactionalSave }),
      query,
    } as unknown as EntityManager;
    const transaction = jest
      .fn()
      .mockImplementation((work: (entityManager: EntityManager) => Promise<Building>) =>
        work(manager),
      );
    const typeOrmRepository = {
      manager: { transaction },
    } as unknown as Repository<Building>;
    const repository = new BuildingTypeOrmRepository(typeOrmRepository);

    await expect(repository.saveWithUnitNeighborhoodPropagation(building, true)).resolves.toBe(
      building,
    );

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transactionalSave).toHaveBeenCalledWith(building);
    expect(query).toHaveBeenCalledWith(
      `UPDATE "property_units" SET "neighborhood" = $1 WHERE "building_id" = $2`,
      ['Bela Vista', building.id],
    );
  });

  it('does not update units when the neighborhood is unchanged', async () => {
    const building = Building.create('Edifício Aurora', 'Centro');
    const transactionalSave = jest.fn().mockResolvedValue(building);
    const query = jest.fn();
    const manager = {
      getRepository: jest.fn().mockReturnValue({ save: transactionalSave }),
      query,
    } as unknown as EntityManager;
    const transaction = jest
      .fn()
      .mockImplementation((work: (entityManager: EntityManager) => Promise<Building>) =>
        work(manager),
      );
    const repository = new BuildingTypeOrmRepository({
      manager: { transaction },
    } as unknown as Repository<Building>);

    await repository.saveWithUnitNeighborhoodPropagation(building, false);

    expect(transactionalSave).toHaveBeenCalledWith(building);
    expect(query).not.toHaveBeenCalled();
  });
});
