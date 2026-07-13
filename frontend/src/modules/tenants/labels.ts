import type { TenantCivilStatus } from '../../api/contract';

export function civilStatusLabel(status: TenantCivilStatus): string {
  const labels: Record<TenantCivilStatus, string> = {
    SINGLE: 'Solteiro(a)',
    MARRIED: 'Casado(a)',
    DIVORCED: 'Divorciado(a)',
    WIDOWED: 'Viúvo(a)',
    STABLE_UNION: 'União estável',
  };
  return labels[status];
}
