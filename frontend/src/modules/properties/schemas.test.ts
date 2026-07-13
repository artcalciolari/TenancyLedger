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
});
