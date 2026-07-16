import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { Building } from './domain/building.entity';
import type { BuildingOccupancyView, IBuildingRepository } from './domain/building.repository';
import { BuildingService } from './building.service';

const BUILDING_ID = '3d6f0c9e-3c9a-4d3b-9d0a-8f6e5c1a2b3c';
const OTHER_BUILDING_ID = '5a6d9d30-f66f-48fb-bd0a-e02afc972b65';
const CREATED_AT = new Date('2026-07-12T12:00:00.000Z');

function persistedBuilding(id = BUILDING_ID): Building {
  const building = Building.create('  Edifício   Aurora ', '  Centro  ');
  Object.defineProperties(building, {
    id: { value: id, configurable: true },
    createdAt: { value: CREATED_AT, configurable: true },
  });
  return building;
}

function occupancyView(overrides: Partial<BuildingOccupancyView> = {}): BuildingOccupancyView {
  return {
    id: BUILDING_ID,
    name: 'Edifício Aurora',
    neighborhood: 'Centro',
    address: null,
    createdAt: CREATED_AT,
    totalUnits: 4,
    occupiedUnits: 2,
    ...overrides,
  };
}

function queryFailure(code: string): QueryFailedError {
  const driverError = Object.assign(new Error(`PostgreSQL ${code}`), { code });
  return new QueryFailedError('INSERT INTO buildings', [], driverError);
}

describe('BuildingService', () => {
  let repository: jest.Mocked<IBuildingRepository>;
  let service: BuildingService;
  let save: jest.MockedFunction<IBuildingRepository['save']>;
  let saveWithUnitNeighborhoodPropagation: jest.MockedFunction<
    IBuildingRepository['saveWithUnitNeighborhoodPropagation']
  >;
  let findById: jest.MockedFunction<IBuildingRepository['findById']>;
  let findByName: jest.MockedFunction<IBuildingRepository['findByName']>;
  let list: jest.MockedFunction<IBuildingRepository['list']>;
  let occupancyFor: jest.MockedFunction<IBuildingRepository['occupancyFor']>;
  let listUnits: jest.MockedFunction<IBuildingRepository['listUnits']>;

  beforeEach(() => {
    save = jest.fn().mockImplementation((building: Building) => Promise.resolve(building));
    saveWithUnitNeighborhoodPropagation = jest
      .fn()
      .mockImplementation((building: Building) => Promise.resolve(building));
    findById = jest.fn().mockResolvedValue(null);
    findByName = jest.fn().mockResolvedValue(null);
    list = jest.fn().mockResolvedValue({ items: [], total: 0 });
    occupancyFor = jest.fn().mockResolvedValue(null);
    listUnits = jest.fn().mockResolvedValue([]);
    repository = {
      save,
      saveWithUnitNeighborhoodPropagation,
      findById,
      findByName,
      list,
      occupancyFor,
      listUnits,
    };
    service = new BuildingService(repository);
  });

  describe('update', () => {
    beforeEach(() => {
      occupancyFor.mockResolvedValue(occupancyView({ name: 'Edifício Solar' }));
    });

    it('updates editable fields and returns the refreshed detail', async () => {
      const building = persistedBuilding();
      let linkedUnitNeighborhood = building.neighborhood;
      findById.mockResolvedValue(building);
      saveWithUnitNeighborhoodPropagation.mockImplementation(
        (updatedBuilding, propagateNeighborhood) => {
          if (propagateNeighborhood) linkedUnitNeighborhood = updatedBuilding.neighborhood;
          return Promise.resolve(updatedBuilding);
        },
      );
      occupancyFor.mockResolvedValue(
        occupancyView({ name: 'Edifício Solar', neighborhood: 'Bela Vista' }),
      );
      listUnits.mockImplementation(() =>
        Promise.resolve([
          {
            id: 'unit-1',
            unitNumber: '101',
            type: 'APARTMENT' as never,
            neighborhood: linkedUnitNeighborhood,
            occupied: false,
          },
        ]),
      );

      await expect(
        service.update(BUILDING_ID, {
          name: ' Edifício   Solar ',
          neighborhood: ' Bela Vista ',
          address: ' Rua Um, 10 ',
        }),
      ).resolves.toEqual({
        ...occupancyView({ name: 'Edifício Solar', neighborhood: 'Bela Vista' }),
        units: [
          {
            id: 'unit-1',
            unitNumber: '101',
            type: 'APARTMENT',
            neighborhood: 'Bela Vista',
            occupied: false,
          },
        ],
      });

      expect(building).toMatchObject({
        name: 'Edifício Solar',
        neighborhood: 'Bela Vista',
        address: 'Rua Um, 10',
      });
      expect(saveWithUnitNeighborhoodPropagation).toHaveBeenCalledWith(building, true);
    });

    it('rejects an unknown building', async () => {
      await expect(service.update(BUILDING_ID, { name: 'Novo nome' })).rejects.toThrow(
        new NotFoundException('Prédio não encontrado.'),
      );
      expect(saveWithUnitNeighborhoodPropagation).not.toHaveBeenCalled();
    });

    it('rejects a name used by another building', async () => {
      findById.mockResolvedValue(persistedBuilding());
      findByName.mockResolvedValue(persistedBuilding(OTHER_BUILDING_ID));

      await expect(service.update(BUILDING_ID, { name: 'Edifício Aurora' })).rejects.toThrow(
        new ConflictException('Já existe um prédio com este nome.'),
      );
      expect(saveWithUnitNeighborhoodPropagation).not.toHaveBeenCalled();
    });

    it('allows the current building name with different casing', async () => {
      const building = persistedBuilding();
      findById.mockResolvedValue(building);
      findByName.mockResolvedValue(building);

      await service.update(BUILDING_ID, { name: 'EDIFÍCIO AURORA' });

      expect(saveWithUnitNeighborhoodPropagation).toHaveBeenCalledWith(building, false);
    });

    it('maps a concurrent unique violation to a conflict', async () => {
      findById.mockResolvedValue(persistedBuilding());
      saveWithUnitNeighborhoodPropagation.mockRejectedValue(queryFailure('23505'));

      await expect(service.update(BUILDING_ID, { name: 'Edifício Solar' })).rejects.toThrow(
        new ConflictException('Já existe um prédio com este nome.'),
      );
    });
  });

  describe('create', () => {
    it('persists a building after checking name uniqueness', async () => {
      const result = await service.create({
        name: '  Edifício   Aurora ',
        neighborhood: '  Centro  ',
      });

      expect(result).toMatchObject({ name: 'Edifício Aurora', neighborhood: 'Centro' });
      expect(findByName).toHaveBeenCalledWith('Edifício Aurora');
      expect(save).toHaveBeenCalledWith(result);
    });

    it('rejects a name found by the duplicate pre-check', async () => {
      findByName.mockResolvedValue(persistedBuilding());

      await expect(
        service.create({ name: 'Edifício Aurora', neighborhood: 'Centro' }),
      ).rejects.toThrow(new ConflictException('Já existe um prédio com este nome.'));

      expect(save).not.toHaveBeenCalled();
    });

    it('maps a concurrent PostgreSQL unique violation to a conflict', async () => {
      save.mockRejectedValue(queryFailure('23505'));

      await expect(
        service.create({ name: 'Edifício Aurora', neighborhood: 'Centro' }),
      ).rejects.toThrow(new ConflictException('Já existe um prédio com este nome.'));
    });

    it('preserves an unexpected persistence error', async () => {
      const error = new Error('database unavailable');
      save.mockRejectedValue(error);

      await expect(
        service.create({ name: 'Edifício Aurora', neighborhood: 'Centro' }),
      ).rejects.toBe(error);
    });
  });

  describe('list', () => {
    it('returns paginated building views', async () => {
      list.mockResolvedValue({ items: [occupancyView()], total: 41 });

      await expect(service.list({ page: 3, limit: 20 })).resolves.toEqual({
        data: [occupancyView()],
        meta: { page: 3, limit: 20, total: 41, totalPages: 3 },
      });
    });
  });

  describe('getById', () => {
    it('combines occupancy and units for the detail view', async () => {
      occupancyFor.mockResolvedValue(occupancyView());
      listUnits.mockResolvedValue([
        {
          id: 'unit-1',
          unitNumber: '101',
          type: 'APARTMENT' as never,
          neighborhood: 'Centro',
          occupied: true,
        },
      ]);

      await expect(service.getById(BUILDING_ID)).resolves.toEqual({
        ...occupancyView(),
        units: [
          {
            id: 'unit-1',
            unitNumber: '101',
            type: 'APARTMENT',
            neighborhood: 'Centro',
            occupied: true,
          },
        ],
      });
    });

    it('rejects an unknown building', async () => {
      await expect(service.getById(BUILDING_ID)).rejects.toThrow(
        new NotFoundException('Prédio não encontrado.'),
      );
    });
  });
});
