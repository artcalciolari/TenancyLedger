import type { UserRole } from '../../api/contract';

export const MANAGEMENT_ROLES: readonly UserRole[] = ['ADMIN', 'MANAGER'];

export function hasRole(role: UserRole, allowedRoles: readonly UserRole[]): boolean {
  return allowedRoles.includes(role);
}

export function roleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    ADMIN: 'Administrador',
    MANAGER: 'Gestor',
    VIEWER: 'Consulta',
  };
  return labels[role];
}
