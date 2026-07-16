import { describe, expect, it } from 'vitest';
import { createPropertySchema } from './schemas';

describe('createPropertySchema', () => {
  it('normaliza espaços dos campos textuais', () => {
    const result = createPropertySchema.parse({
      neighborhood: '  Centro ',
      type: 'APARTMENT',
      unitNumber: ' 101-A ',
    });
    expect(result).toEqual({ neighborhood: 'Centro', type: 'APARTMENT', unitNumber: '101-A' });
  });

  it('rejeita unidade vazia', () => {
    expect(
      createPropertySchema.safeParse({ neighborhood: 'Centro', type: 'HOUSE', unitNumber: ' ' })
        .success,
    ).toBe(false);
  });

  it('exige bairro para uma unidade sem prédio', () => {
    expect(
      createPropertySchema.safeParse({ type: 'HOUSE', unitNumber: '1', buildingId: '' }).success,
    ).toBe(false);
  });

  it('aceita buildingId ausente ou UUID válido sem bairro informado', () => {
    expect(
      createPropertySchema.safeParse({ neighborhood: 'Centro', type: 'HOUSE', unitNumber: '1' })
        .success,
    ).toBe(true);
    expect(
      createPropertySchema.safeParse({
        type: 'HOUSE',
        unitNumber: '1',
        buildingId: '3d6f0c9e-3c9a-4d3b-9d0a-8f6e5c1a2b3c',
      }).success,
    ).toBe(true);
  });

  it('rejeita buildingId inválido', () => {
    expect(
      createPropertySchema.safeParse({
        neighborhood: 'Centro',
        type: 'HOUSE',
        unitNumber: '1',
        buildingId: 'not-a-uuid',
      }).success,
    ).toBe(false);
  });
});
