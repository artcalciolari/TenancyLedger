import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { PropertyUnit, UnitType } from './domain/property-unit.entity';
import { Building } from './domain/building.entity';
import type { IPropertyRepository, PropertyWithOccupancy } from './domain/property.repository';
import { PropertyService } from './property.service';
import { ValidationError } from '../../core/domain/errors/validation.error';

const PROPERTY_ID = 'c2926b25-4e17-44a8-8097-9c093f842cbb';
const OTHER_PROPERTY_ID = 'f14f0701-daad-478c-a7ac-5ccb6b96a6af';
const BUILDING_ID = '3d6f0c9e-3c9a-4d3b-9d0a-8f6e5c1a2b3c';
const OTHER_BUILDING_ID = '5a6d9d30-f66f-48fb-bd0a-e02afc972b65';
const CREATED_AT = new Date('2026-07-12T12:00:00.000Z');

function persistedBuilding(id = BUILDING_ID, neighborhood = 'Jardim América'): Building {
  const building = Building.create(`Prédio ${id}`, neighborhood);
  Object.defineProperty(building, 'id', { value: id, configurable: true });
  return building;
}

function persistedProperty(buildingId: string | null = null, id = PROPERTY_ID): PropertyUnit {
  const property = PropertyUnit.create(
    'Jardim América',
    UnitType.APARTMENT,
    '  Bloco A   101 ',
    buildingId,
  );
  Object.defineProperties(property, {
    id: { value: id, configurable: true },
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
  let buildingRepository: jest.Mocked<Pick<Repository<Building>, 'findOneBy'>>;
  let service: PropertyService;
  let save: jest.MockedFunction<IPropertyRepository['save']>;
  let findById: jest.MockedFunction<IPropertyRepository['findById']>;
  let findByLocation: jest.MockedFunction<IPropertyRepository['findByLocation']>;
  let findByBuildingUnit: jest.MockedFunction<IPropertyRepository['findByBuildingUnit']>;
  let list: jest.MockedFunction<IPropertyRepository['list']>;
  let getView: jest.MockedFunction<IPropertyRepository['getView']>;

  beforeEach(() => {
    save = jest.fn().mockImplementation((property: PropertyUnit) => Promise.resolve(property));
    findById = jest.fn().mockResolvedValue(null);
    findByLocation = jest.fn().mockResolvedValue(null);
    findByBuildingUnit = jest.fn().mockResolvedValue(null);
    list = jest.fn().mockResolvedValue({ items: [], total: 0 });
    getView = jest.fn().mockResolvedValue(null);
    repository = {
      save,
      findById,
      findByLocation,
      findByBuildingUnit,
      list,
      getView,
    };
    buildingRepository = {
      findOneBy: jest.fn().mockResolvedValue(persistedBuilding()),
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
      expect(findByBuildingUnit).not.toHaveBeenCalled();
      expect(save).toHaveBeenCalledWith(result);
      expect(buildingRepository.findOneBy).not.toHaveBeenCalled();
    });

    it('validates the building exists when buildingId is informed', async () => {
      buildingRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.create({
          type: UnitType.APARTMENT,
          unitNumber: '101',
          buildingId: BUILDING_ID,
        }),
      ).rejects.toThrow(new NotFoundException('Prédio não encontrado.'));

      expect(save).not.toHaveBeenCalled();
    });

    it('derives the neighborhood when persisting a property linked to a building', async () => {
      const result = await service.create({
        neighborhood: 'Este valor deve ser ignorado',
        type: UnitType.APARTMENT,
        unitNumber: '101',
        buildingId: BUILDING_ID,
      });

      expect(buildingRepository.findOneBy).toHaveBeenCalledWith({ id: BUILDING_ID });
      expect(findByBuildingUnit).toHaveBeenCalledWith(BUILDING_ID, '101');
      expect(findByLocation).not.toHaveBeenCalled();
      expect(result.buildingId).toBe(BUILDING_ID);
      expect(result.neighborhood).toBe('Jardim América');
    });

    it('rejects a duplicate unit number inside the same building', async () => {
      findByBuildingUnit.mockResolvedValue(persistedProperty(BUILDING_ID));

      await expect(
        service.create({
          type: UnitType.APARTMENT,
          unitNumber: '101',
          buildingId: BUILDING_ID,
        }),
      ).rejects.toThrow(
        new ConflictException('Já existe uma unidade com este número neste prédio.'),
      );

      expect(save).not.toHaveBeenCalled();
    });

    it('allows the same unit number in different buildings from the same neighborhood', async () => {
      buildingRepository.findOneBy
        .mockResolvedValueOnce(persistedBuilding(BUILDING_ID, 'Jardim América'))
        .mockResolvedValueOnce(persistedBuilding(OTHER_BUILDING_ID, 'Jardim América'));

      await service.create({
        type: UnitType.APARTMENT,
        unitNumber: '101',
        buildingId: BUILDING_ID,
      });
      await service.create({
        type: UnitType.APARTMENT,
        unitNumber: '101',
        buildingId: OTHER_BUILDING_ID,
      });

      expect(findByBuildingUnit).toHaveBeenNthCalledWith(1, BUILDING_ID, '101');
      expect(findByBuildingUnit).toHaveBeenNthCalledWith(2, OTHER_BUILDING_ID, '101');
      expect(save).toHaveBeenCalledTimes(2);
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

    it('uses the building-specific conflict for a concurrent unique violation', async () => {
      save.mockRejectedValue(queryFailure('23505'));

      await expect(
        service.create({
          type: UnitType.APARTMENT,
          unitNumber: '101',
          buildingId: BUILDING_ID,
        }),
      ).rejects.toThrow(
        new ConflictException('Já existe uma unidade com este número neste prédio.'),
      );
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

  describe('update', () => {
    it('updates the editable fields of a standalone property', async () => {
      const property = persistedProperty();
      findById.mockResolvedValue(property);

      await expect(
        service.update(PROPERTY_ID, {
          neighborhood: ' Bela   Vista ',
          unitNumber: ' 202 B ',
          type: UnitType.HOUSE,
        }),
      ).resolves.toBe(property);

      expect(property).toMatchObject({
        neighborhood: 'Bela Vista',
        unitNumber: '202 B',
        type: UnitType.HOUSE,
      });
      expect(findByLocation).toHaveBeenCalledWith('Bela Vista', '202 B');
      expect(save).toHaveBeenCalledWith(property);
    });

    it('updates a linked property without changing its building or neighborhood', async () => {
      const property = persistedProperty(BUILDING_ID);
      findById.mockResolvedValue(property);

      await service.update(PROPERTY_ID, {
        buildingId: undefined,
        neighborhood: undefined,
        unitNumber: '202',
        type: UnitType.ROOM,
      });

      expect(findByBuildingUnit).toHaveBeenCalledWith(BUILDING_ID, '202');
      expect(property).toMatchObject({
        buildingId: BUILDING_ID,
        neighborhood: 'Jardim América',
        unitNumber: '202',
        type: UnitType.ROOM,
      });
    });

    it('rejects an unknown property', async () => {
      await expect(service.update(PROPERTY_ID, { unitNumber: '202' })).rejects.toThrow(
        new NotFoundException('Unidade imobiliária não encontrada.'),
      );
      expect(save).not.toHaveBeenCalled();
    });

    it('rejects an attempt to change the building link', async () => {
      findById.mockResolvedValue(persistedProperty());

      await expect(service.update(PROPERTY_ID, { buildingId: BUILDING_ID })).rejects.toThrow(
        new ValidationError('O vínculo da unidade com o prédio é imutável.'),
      );
      expect(save).not.toHaveBeenCalled();
    });

    it('rejects a neighborhood change for a linked property', async () => {
      findById.mockResolvedValue(persistedProperty(BUILDING_ID));

      await expect(service.update(PROPERTY_ID, { neighborhood: 'Outro bairro' })).rejects.toThrow(
        new ValidationError('O bairro de uma unidade vinculada é definido pelo prédio.'),
      );
      expect(save).not.toHaveBeenCalled();
    });

    it('rejects a duplicate location during update', async () => {
      findById.mockResolvedValue(persistedProperty());
      findByLocation.mockResolvedValue(persistedProperty(null, OTHER_PROPERTY_ID));

      await expect(service.update(PROPERTY_ID, { unitNumber: '202' })).rejects.toThrow(
        new ConflictException('Já existe uma unidade com este bairro e número.'),
      );
      expect(save).not.toHaveBeenCalled();
    });

    it('maps a concurrent unique violation during update to a conflict', async () => {
      findById.mockResolvedValue(persistedProperty(BUILDING_ID));
      save.mockRejectedValue(queryFailure('23505'));

      await expect(service.update(PROPERTY_ID, { unitNumber: '202' })).rejects.toThrow(
        new ConflictException('Já existe uma unidade com este número neste prédio.'),
      );
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
