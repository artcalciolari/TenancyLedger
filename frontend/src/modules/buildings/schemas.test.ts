import { describe, expect, it } from 'vitest';
import { createBuildingSchema } from './schemas';

describe('createBuildingSchema', () => {
  it('remove espaços nas extremidades e aceita endereço opcional', () => {
    const result = createBuildingSchema.parse({
      name: '  Edifício Aurora ',
      neighborhood: '  Centro ',
      address: '',
    });
    expect(result).toEqual({ name: 'Edifício Aurora', neighborhood: 'Centro', address: '' });
  });

  it('rejeita nome vazio', () => {
    expect(
      createBuildingSchema.safeParse({ name: ' ', neighborhood: 'Centro' }).success,
    ).toBe(false);
  });

  it('rejeita bairro vazio', () => {
    expect(
      createBuildingSchema.safeParse({ name: 'Edifício Aurora', neighborhood: ' ' }).success,
    ).toBe(false);
  });
});
