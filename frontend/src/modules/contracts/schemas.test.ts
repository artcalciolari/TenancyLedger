import { describe, expect, it } from 'vitest';
import { createContractSchema, renewContractSchema } from './schemas';

const validContract = {
  tenantId: '7d9cdddc-8661-44ee-af5d-b420099509ca',
  propertyUnitId: 'd0208cb2-3688-4778-a056-93cb82e31166',
  moveInDate: '2026-07-12',
  monthlyBaseValue: 'R$ 1.500,00',
  durationInMonths: 12,
  billingDay: 10,
  isRenewable: true,
};

describe('createContractSchema', () => {
  it('aceita os limites válidos do contrato', () => {
    expect(createContractSchema.safeParse(validContract).success).toBe(true);
    expect(createContractSchema.safeParse({ ...validContract, billingDay: null }).success).toBe(
      true,
    );
  });

  it.each([
    { tenantId: '' },
    { propertyUnitId: 'inválido' },
    { moveInDate: '12/07/2026' },
    { moveInDate: '2026-02-31' },
    { monthlyBaseValue: '0' },
    { durationInMonths: 601 },
    { billingDay: 29 },
  ])('rejeita entrada inválida %#', (change) => {
    expect(createContractSchema.safeParse({ ...validContract, ...change }).success).toBe(false);
  });
});

describe('renewContractSchema', () => {
  it('aceita de 1 a 600 meses inteiros', () => {
    expect(renewContractSchema.safeParse({ extraMonths: 1 }).success).toBe(true);
    expect(renewContractSchema.safeParse({ extraMonths: 600 }).success).toBe(true);
  });

  it.each([0, 1.5, 601])('rejeita %s meses', (extraMonths) => {
    expect(renewContractSchema.safeParse({ extraMonths }).success).toBe(false);
  });
});
