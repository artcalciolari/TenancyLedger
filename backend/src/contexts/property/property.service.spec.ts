import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { PropertyUnit, UnitType } from './domain/property-unit.entity';
import { Building } from './domain/building.entity';
import type { IPropertyRepository, PropertyWithOccupancy } from './domain/property.repository';
import { PropertyService } from './property.service';

const PROPERTY_ID = 'c2926b25-4e17-44a8-8097-9c093f842cbb';
const BUILDING_ID = '3d6f0c9e-3c9a-4d3b-9d0a-8f6e5c1a2b3c';
const CREATED_AT = new Date('2026-07-12T12:00:00.000Z');

function persistedProperty(buildingId: string | null = null): PropertyUnit {
  const property = PropertyUnit.create(
    'Jardim América',
    UnitType.APARTMENT,
    '  Bloco A   101 ',
    buildingId,
  );
  Object.defineProperties(property, {
    id: { value: PROPERTY_ID, configurable: true },
    createdAt: { value: CREATED_AT, configurable: true },
  });
  return property;
}

function withOccupancy(
  property: PropertyUnit,
  buildingName: string | null = null,
  occupied = false,
): PropertyWithOccupancy {
  return { property, buildingName, occupied };
}

function queryFailure(code: string): QueryFailedError {
  const driverError = Object.assign(new Error(`PostgreSQL ${code}`), { code });
  return new QueryFailedError('INSERT INTO property_units', [], driverError);
}

describe('PropertyService', () => {
  let repository: jest.Mocked<IPropertyRepository>;
  let buildingRepository: jest.Mocked<Pick<Repository<Building>, 'existsBy'>>;
  let service: PropertyService;
  let save: jest.MockedFunction<IPropertyRepository['save']>;
  let findById: jest.MockedFunction<IPropertyRepository['findById']>;
  let findByLocation: jest.MockedFunction<IPropertyRepository['findByLocation']>;
  let list: jest.MockedFunction<IPropertyRepository['list']>;
  let getView: jest.MockedFunction<IPropertyRepository['getView']>;

  beforeEach(() => {
    save = jest.fn().mockImplementation((property: PropertyUnit) => Promise.resolve(property));
    findById = jest.fn().mockResolvedValue(null);
    findByLocation = jest.fn().mockResolvedValue(null);
    list = jest.fn().mockResolvedValue({ items: [], total: 0 });
    getView = jest.fn().mockResolvedValue(null);
    repository = {
      save,
      findById,
      findByLocation,
      list,
      getView,
    };
    buildingRepository = {
      existsBy: jest.fn().mockResolvedValue(true),
    };
    service = new PropertyService(
      repository,
      buildingRepository as unknown as Repository<Building>,
    );
  });

  describe('create', () => {
    it('pre-checks the normalized location and persists a property', async () => {
      const result = await service.create({
        neighborhood: '  Jardim   América ',
        type: UnitType.APARTMENT,
        unitNumber: ' Bloco A   101 ',
      });

      expect(result).toMatchObject({
        neighborhood: 'Jardim América',
        type: UnitType.APARTMENT,
        unitNumber: 'Bloco A 101',
      });
      expect(findByLocation).toHaveBeenCalledWith('Jardim América', 'Bloco A 101');
      expect(save).toHaveBeenCalledWith(result);
      expect(buildingRepository.existsBy).not.toHaveBeenCalled();
    });

    it('validates the building exists when buildingId is informed', async () => {
      buildingRepository.existsBy.mockResolvedValue(false);

      await expect(
        service.create({
          neighborhood: 'Jardim América',
          type: UnitType.APARTMENT,
          unitNumber: '101',
          buildingId: BUILDING_ID,
        }),
      ).rejects.toThrow(new NotFoundException('Prédio não encontrado.'));

      expect(save).not.toHaveBeenCalled();
    });

    it('persists a property linked to an existing building', async () => {
      const result = await service.create({
        neighborhood: 'Jardim América',
        type: UnitType.APARTMENT,
        unitNumber: '101',
        buildingId: BUILDING_ID,
      });

      expect(buildingRepository.existsBy).toHaveBeenCalledWith({ id: BUILDING_ID });
      expect(result.buildingId).toBe(BUILDING_ID);
    });

    it('rejects a location found by the duplicate pre-check', async () => {
      findByLocation.mockResolvedValue(persistedProperty());

      await expect(
        service.create({
          neighborhood: 'Jardim América',
          type: UnitType.APARTMENT,
          unitNumber: 'Bloco A 101',
        }),
      ).rejects.toThrow(new ConflictException('Já existe uma unidade com este bairro e número.'));

      expect(save).not.toHaveBeenCalled();
    });

    it('maps a concurrent PostgreSQL unique violation to a conflict', async () => {
      save.mockRejectedValue(queryFailure('23505'));

      await expect(
        service.create({
          neighborhood: 'Jardim América',
          type: UnitType.APARTMENT,
          unitNumber: '101',
        }),
      ).rejects.toThrow(new ConflictException('Já existe uma unidade com este bairro e número.'));
    });

    it('preserves an unexpected persistence error', async () => {
      const error = new Error('database unavailable');
      save.mockRejectedValue(error);

      await expect(
        service.create({
          neighborhood: 'Jardim América',
          type: UnitType.APARTMENT,
          unitNumber: '101',
        }),
      ).rejects.toBe(error);
    });
  });

  describe('getById', () => {
    it('returns the property view found by id', async () => {
      const property = persistedProperty();
      getView.mockResolvedValue(withOccupancy(property, 'Edifício Aurora', true));

      await expect(service.getById(PROPERTY_ID)).resolves.toEqual({
        id: PROPERTY_ID,
        neighborhood: 'Jardim América',
        type: UnitType.APARTMENT,
        unitNumber: 'Bloco A 101',
        createdAt: CREATED_AT,
        buildingId: null,
        buildingName: 'Edifício Aurora',
        occupied: true,
      });
      expect(getView).toHaveBeenCalledWith(PROPERTY_ID, expect.any(String));
    });

    it('rejects an unknown property', async () => {
      await expect(service.getById(PROPERTY_ID)).rejects.toThrow(
        new NotFoundException('Unidade imobiliária não encontrada.'),
      );
    });
  });

  describe('list', () => {
    it('returns paginated property views', async () => {
      const property = persistedProperty();
      list.mockResolvedValue({ items: [withOccupancy(property)], total: 41 });

      await expect(service.list({ page: 3, limit: 20 })).resolves.toEqual({
        data: [
          {
            id: PROPERTY_ID,
            neighborhood: 'Jardim América',
            type: UnitType.APARTMENT,
            unitNumber: 'Bloco A 101',
            createdAt: CREATED_AT,
            buildingId: null,
            buildingName: null,
            occupied: false,
          },
        ],
        meta: { page: 3, limit: 20, total: 41, totalPages: 3 },
      });
      const [call] = list.mock.calls;
      expect(call?.[0]).toMatchObject({ page: 3, limit: 20 });
      expect(call?.[0].asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('uses the default first page', async () => {
      await service.list();

      const [call] = list.mock.calls;
      expect(call?.[0]).toMatchObject({ page: 1, limit: 20 });
      expect(call?.[0].asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('maps only public property fields in toView', () => {
    expect(
      PropertyService.toView(withOccupancy(persistedProperty(), 'Edifício Aurora', true)),
    ).toEqual({
      id: PROPERTY_ID,
      neighborhood: 'Jardim América',
      type: UnitType.APARTMENT,
      unitNumber: 'Bloco A 101',
      createdAt: CREATED_AT,
      buildingId: null,
      buildingName: 'Edifício Aurora',
      occupied: true,
    });
  });
});
