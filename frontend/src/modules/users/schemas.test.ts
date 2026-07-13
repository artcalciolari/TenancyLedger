import { describe, expect, it } from 'vitest';
import { createUserSchema, updateUserAccessSchema } from './schemas';

describe('createUserSchema', () => {
  it('aceita uma senha forte confirmada', () => {
    expect(
      createUserSchema.safeParse({
        email: 'admin@example.com',
        password: 'Senha#Forte123',
        confirmPassword: 'Senha#Forte123',
        role: 'ADMIN',
      }).success,
    ).toBe(true);
  });

  it('rejeita senha sem complexidade e confirmação divergente', () => {
    const result = createUserSchema.safeParse({
      email: 'admin@example.com',
      password: 'senha-fraca',
      confirmPassword: 'outra-senha',
      role: 'ADMIN',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateUserAccessSchema', () => {
  it('exige um papel conhecido e estado booleano', () => {
    expect(updateUserAccessSchema.safeParse({ role: 'VIEWER', active: false }).success).toBe(true);
    expect(updateUserAccessSchema.safeParse({ role: 'OWNER', active: true }).success).toBe(false);
  });
});
