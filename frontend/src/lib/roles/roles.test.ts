import { describe, expect, it } from 'vitest';
import { hasRole, MANAGEMENT_ROLES, roleLabel } from './roles';

describe('roles', () => {
  it('reconhece papéis autorizados', () => {
    expect(hasRole('MANAGER', MANAGEMENT_ROLES)).toBe(true);
    expect(hasRole('VIEWER', MANAGEMENT_ROLES)).toBe(false);
  });

  it.each([
    ['ADMIN', 'Administrador'],
    ['MANAGER', 'Gestor'],
    ['VIEWER', 'Consulta'],
  ] as const)('traduz %s', (role, label) => {
    expect(roleLabel(role)).toBe(label);
  });
});
