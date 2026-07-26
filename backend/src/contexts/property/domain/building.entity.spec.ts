import { ValidationError } from '../../../core/domain/errors/validation.error';
import { Building } from './building.entity';

describe('Building', () => {
  it('normalizes required text and accepts no address', () => {
    const building = Building.create('  Edifício   Aurora ', '  Centro  ');

    expect(building.name).toBe('Edifício Aurora');
    expect(building.neighborhood).toBe('Centro');
    expect(building.address).toBeNull();
  });

  it('normalizes an informed address', () => {
    const building = Building.create('Edifício Aurora', 'Centro', '  Rua das Flores,   123  ');

    expect(building.address).toBe('Rua das Flores, 123');
  });

  it('treats a blank address as absent', () => {
    const building = Building.create('Edifício Aurora', 'Centro', '   ');

    expect(building.address).toBeNull();
  });

  it('keeps all fields when update receives no changes', () => {
    const building = Building.create('Edifício Aurora', 'Centro', 'Rua das Flores, 123');

    building.update({});

    expect(building).toMatchObject({
      name: 'Edifício Aurora',
      neighborhood: 'Centro',
      address: 'Rua das Flores, 123',
    });
  });

  it.each([
    ['', 'Centro'],
    ['Edifício Aurora', ''],
  ])('rejects blank required fields', (name, neighborhood) => {
    expect(() => Building.create(name, neighborhood)).toThrow(ValidationError);
  });

  it('rejects a name longer than 120 characters', () => {
    expect(() => Building.create('A'.repeat(121), 'Centro')).toThrow(ValidationError);
  });

  it('rejects an address longer than 200 characters', () => {
    expect(() => Building.create('Edifício Aurora', 'Centro', 'A'.repeat(201))).toThrow(
      ValidationError,
    );
  });
});
