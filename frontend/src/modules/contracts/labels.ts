import type { ContractStatus } from '../../api/contract';

export const contractStatusLabels: Record<ContractStatus, string> = {
  ACTIVE: 'Ativo',
  EXPIRED: 'Expirado',
  TERMINATED: 'Encerrado',
};
