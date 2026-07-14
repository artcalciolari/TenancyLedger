import { ValidationError } from '../../../core/domain/errors/validation.error';
import { PropertyUnit, UnitType } from './property-unit.entity';

describe('PropertyUnit', () => {
  it('normalizes required text', () => {
    const property = PropertyUnit.create('  Vila   Mariana ', UnitType.APARTMENT, '  12 A ');

    expect(property.neighborhood).toBe('Vila Mariana');
    expect(property.unitNumber).toBe('12 A');
    expect(property.type).toBe(UnitType.APARTMENT);
    expect(property.buildingId).toBeNull();
  });

  it('accepts an optional building id', () => {
    const buildingId = '3d6f0c9e-3c9a-4d3b-9d0a-8f6e5c1a2b3c';
    const property = PropertyUnit.create('Centro', UnitType.APARTMENT, '12 A', buildingId);

    expect(property.buildingId).toBe(buildingId);
  });

  it.each([
    ['', UnitType.ROOM, '1'],
    ['Centro', UnitType.ROOM, '  '],
  ])('rejects blank location fields', (neighborhood, type, unitNumber) => {
    expect(() => PropertyUnit.create(neighborhood, type, unitNumber)).toThrow(ValidationError);
  });

  it('rejects an unknown unit type', () => {
    expect(() => PropertyUnit.create('Centro', 'GARAGE' as UnitType, '1')).toThrow(ValidationError);
  });
});
