import type { ContractStatus } from '../../api/contract';

export const contractStatusLabels: Record<ContractStatus, string> = {
  PENDING_SIGNATURE: 'Aguardando assinatura',
  PAYMENT_PENDING: 'Pagamento pendente',
  ACTIVE: 'Ativo',
  ENDING: 'Encerramento programado',
  EXPIRED: 'Expirado',
  TERMINATED: 'Encerrado',
  CANCELLED: 'Cancelado',
};
