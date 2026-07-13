import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { PropertyUnit, UnitType } from './domain/property-unit.entity';
import type { IPropertyRepository } from './domain/property.repository';
import { PropertyService } from './property.service';

const PROPERTY_ID = 'c2926b25-4e17-44a8-8097-9c093f842cbb';
const CREATED_AT = new Date('2026-07-12T12:00:00.000Z');

function persistedProperty(): PropertyUnit {
  const property = PropertyUnit.create('Jardim América', UnitType.APARTMENT, '  Bloco A   101 ');
  Object.defineProperties(property, {
    id: { value: PROPERTY_ID, configurable: true },
    createdAt: { value: CREATED_AT, configurable: true },
  });
  return property;
}

function queryFailure(code: string): QueryFailedError {
  const driverError = Object.assign(new Error(`PostgreSQL ${code}`), { code });
  return new QueryFailedError('INSERT INTO property_units', [], driverError);
}

describe('PropertyService', () => {
  let repository: jest.Mocked<IPropertyRepository>;
  let service: PropertyService;
  let save: jest.MockedFunction<IPropertyRepository['save']>;
  let findById: jest.MockedFunction<IPropertyRepository['findById']>;
  let findByLocation: jest.MockedFunction<IPropertyRepository['findByLocation']>;
  let list: jest.MockedFunction<IPropertyRepository['list']>;

  beforeEach(() => {
    save = jest.fn().mockImplementation((property: PropertyUnit) => Promise.resolve(property));
    findById = jest.fn().mockResolvedValue(null);
    findByLocation = jest.fn().mockResolvedValue(null);
    list = jest.fn().mockResolvedValue({ items: [], total: 0 });
    repository = {
      save,
      findById,
      findByLocation,
      list,
    };
    service = new PropertyService(repository);
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
    it('returns the property found by id', async () => {
      const property = persistedProperty();
      findById.mockResolvedValue(property);

      await expect(service.getById(PROPERTY_ID)).resolves.toBe(property);
      expect(findById).toHaveBeenCalledWith(PROPERTY_ID);
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
      list.mockResolvedValue({ items: [property], total: 41 });

      await expect(service.list({ page: 3, limit: 20 })).resolves.toEqual({
        data: [
          {
            id: PROPERTY_ID,
            neighborhood: 'Jardim América',
            type: UnitType.APARTMENT,
            unitNumber: 'Bloco A 101',
            createdAt: CREATED_AT,
          },
        ],
        meta: { page: 3, limit: 20, total: 41, totalPages: 3 },
      });
      expect(list).toHaveBeenCalledWith({ page: 3, limit: 20 });
    });

    it('uses the default first page', async () => {
      await service.list();

      expect(list).toHaveBeenCalledWith({ page: 1, limit: 20 });
    });
  });

  it('maps only public property fields in toView', () => {
    expect(PropertyService.toView(persistedProperty())).toEqual({
      id: PROPERTY_ID,
      neighborhood: 'Jardim América',
      type: UnitType.APARTMENT,
      unitNumber: 'Bloco A 101',
      createdAt: CREATED_AT,
    });
  });
});
