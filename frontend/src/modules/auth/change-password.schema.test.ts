import { describe, expect, it } from 'vitest';
import { changePasswordSchema } from './change-password.schema';

describe('changePasswordSchema', () => {
  it('aceita nova senha forte, diferente e confirmada', () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'Atual#Segura123',
        newPassword: 'Nova#Segura456',
        confirmPassword: 'Nova#Segura456',
      }).success,
    ).toBe(true);
  });

  it('rejeita reutilização da senha atual', () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'Atual#Segura123',
        newPassword: 'Atual#Segura123',
        confirmPassword: 'Atual#Segura123',
      }).success,
    ).toBe(false);
  });
});
