import { ValidationError } from '../../../core/domain/errors/validation.error';
import { Room } from './room.entity';

const BUILDING_ID = '3d6f0c9e-3c9a-4d3b-9d0a-8f6e5c1a2b3c';

describe('Room', () => {
  it('normalizes the room number', () => {
    const room = Room.create(BUILDING_ID, '  101   A ');

    expect(room.number).toBe('101 A');
    expect(room.buildingId).toBe(BUILDING_ID);
  });

  it('requires a building id', () => {
    expect(() => Room.create('', '101')).toThrow(ValidationError);
  });

  it.each([
    ['', 'is blank'],
    ['   ', 'is only whitespace'],
  ])('rejects a room number that %s', (number) => {
    expect(() => Room.create(BUILDING_ID, number)).toThrow(ValidationError);
  });

  it('rejects a room number longer than 40 characters', () => {
    expect(() => Room.create(BUILDING_ID, 'a'.repeat(41))).toThrow(ValidationError);
  });

  describe('update', () => {
    it('normalizes the new number', () => {
      const room = Room.create(BUILDING_ID, '101');

      room.update({ number: '  202   B ' });

      expect(room.number).toBe('202 B');
    });

    it('keeps the current number when not provided', () => {
      const room = Room.create(BUILDING_ID, '101');

      room.update({});

      expect(room.number).toBe('101');
    });

    it('rejects a blank number', () => {
      const room = Room.create(BUILDING_ID, '101');

      expect(() => room.update({ number: '   ' })).toThrow(ValidationError);
    });
  });
});
