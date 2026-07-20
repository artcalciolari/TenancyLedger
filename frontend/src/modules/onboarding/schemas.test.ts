import { describe, expect, it } from 'vitest';
import { onboardingPayloadSchema, referencesSchema, reviewSchema } from './schemas';
import { createEmptyPayload } from './state';

describe('schemas do onboarding', () => {
  it('permite hidratar um rascunho ainda incompleto', () => {
    expect(onboardingPayloadSchema.safeParse(createEmptyPayload()).success).toBe(true);
  });

  it('exige duas referências válidas para concluir', () => {
    const reference = {
      name: 'Joana Lima',
      relationship: 'Irmã',
      phone: '11999999999',
      email: 'joana@example.test',
    };
    expect(referencesSchema.safeParse([reference]).success).toBe(false);
    expect(
      referencesSchema.safeParse([reference, { ...reference, name: 'Carlos Lima' }]).success,
    ).toBe(true);
  });

  it('normaliza telefone brasileiro e rejeita número fora da regra do backend', () => {
    const reference = {
      name: 'Joana Lima',
      relationship: 'Irmã',
      phone: '+55 (11) 3333-4444',
    };
    expect(
      referencesSchema.parse([reference, { ...reference, name: 'Carlos Lima' }])[0]?.phone,
    ).toBe('1133334444');
    expect(
      referencesSchema.safeParse([
        { ...reference, phone: '11012345678' },
        { ...reference, name: 'Carlos Lima' },
      ]).success,
    ).toBe(false);
  });

  it('valida a unidade, data e valor mensal da revisão', () => {
    expect(
      reviewSchema.safeParse({
        propertyUnitId: '30000000-0000-4000-8000-000000000001',
        moveInDate: '2026-07-18',
        monthlyBaseValueCents: 150_000,
      }).success,
    ).toBe(true);
    expect(
      reviewSchema.safeParse({
        propertyUnitId: '',
        moveInDate: '2026-02-30',
        monthlyBaseValueCents: 0,
      }).success,
    ).toBe(false);
  });
});
