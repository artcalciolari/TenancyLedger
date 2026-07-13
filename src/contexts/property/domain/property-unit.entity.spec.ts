import { ValidationError } from '../../../core/domain/errors/validation.error';
import { PropertyUnit, UnitType } from './property-unit.entity';

describe('PropertyUnit', () => {
  it('normalizes required text', () => {
    const property = PropertyUnit.create('  Vila   Mariana ', UnitType.APARTMENT, '  12 A ');

    expect(property.neighborhood).toBe('Vila Mariana');
    expect(property.unitNumber).toBe('12 A');
    expect(property.type).toBe(UnitType.APARTMENT);
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
