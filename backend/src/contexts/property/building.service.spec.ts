import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { Building } from './domain/building.entity';
import type { BuildingOccupancyView, IBuildingRepository } from './domain/building.repository';
import { BuildingService } from './building.service';

const BUILDING_ID = '3d6f0c9e-3c9a-4d3b-9d0a-8f6e5c1a2b3c';
const CREATED_AT = new Date('2026-07-12T12:00:00.000Z');

function persistedBuilding(): Building {
  const building = Building.create('  Edifício   Aurora ', '  Centro  ');
  Object.defineProperties(building, {
    id: { value: BUILDING_ID, configurable: true },
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
  let findByName: jest.MockedFunction<IBuildingRepository['findByName']>;
  let list: jest.MockedFunction<IBuildingRepository['list']>;
  let occupancyFor: jest.MockedFunction<IBuildingRepository['occupancyFor']>;
  let listUnits: jest.MockedFunction<IBuildingRepository['listUnits']>;

  beforeEach(() => {
    save = jest.fn().mockImplementation((building: Building) => Promise.resolve(building));
    findByName = jest.fn().mockResolvedValue(null);
    list = jest.fn().mockResolvedValue({ items: [], total: 0 });
    occupancyFor = jest.fn().mockResolvedValue(null);
    listUnits = jest.fn().mockResolvedValue([]);
    repository = {
      save,
      findById: jest.fn().mockResolvedValue(null),
      findByName,
      list,
      occupancyFor,
      listUnits,
    };
    service = new BuildingService(repository);
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
