import { describe, expect, it } from 'vitest';
import { createTenantSchema } from './schemas';

const validTenant = {
  name: 'Maria da Silva',
  cpf: '123.456.789-09',
  rg: '12.345.678-9',
  profession: 'Engenheiro civil',
  civilStatus: 'MARRIED' as const,
  email: 'locatario@example.com',
  mobilePhone: '+55 11 99999-9999',
};

describe('createTenantSchema', () => {
  it('aceita o formato público do backend', () => {
    expect(createTenantSchema.parse(validTenant).mobilePhone).toBe('11999999999');
  });

  it('rejeita CPF e RG fora do contrato', () => {
    expect(
      createTenantSchema.safeParse({ ...validTenant, cpf: '123', rg: 'RG com espaço' }).success,
    ).toBe(false);
  });

  it('rejeita nome muito curto', () => {
    expect(createTenantSchema.safeParse({ ...validTenant, name: 'Jo' }).success).toBe(false);
  });

  it('rejeita telefone fixo no campo de celular', () => {
    expect(
      createTenantSchema.safeParse({ ...validTenant, mobilePhone: '+55 11 3333-4444' }).success,
    ).toBe(false);
  });
});
