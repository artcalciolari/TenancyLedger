import { describe, expect, it } from 'vitest';
import { createRoomSchema, updateRoomSchema } from './schemas';

describe('createRoomSchema', () => {
  it('normaliza espaços do número do quarto', () => {
    const result = createRoomSchema.parse({
      buildingId: '3d6f0c9e-3c9a-4d3b-9d0a-8f6e5c1a2b3c',
      number: ' 101-A ',
    });
    expect(result).toEqual({
      buildingId: '3d6f0c9e-3c9a-4d3b-9d0a-8f6e5c1a2b3c',
      number: '101-A',
    });
  });

  it('rejeita número vazio', () => {
    expect(
      createRoomSchema.safeParse({
        buildingId: '3d6f0c9e-3c9a-4d3b-9d0a-8f6e5c1a2b3c',
        number: ' ',
      }).success,
    ).toBe(false);
  });

  it('exige um prédio válido', () => {
    expect(createRoomSchema.safeParse({ buildingId: '', number: '1' }).success).toBe(false);
    expect(createRoomSchema.safeParse({ buildingId: 'not-a-uuid', number: '1' }).success).toBe(
      false,
    );
  });
});

describe('updateRoomSchema', () => {
  it.each([
    ['vazio', ''],
    ['somente com espaços', '   '],
  ])('rejeita número %s', (_label, number) => {
    expect(updateRoomSchema.safeParse({ number }).success).toBe(false);
  });
});
