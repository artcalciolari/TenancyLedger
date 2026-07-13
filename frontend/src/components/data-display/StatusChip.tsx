import { Chip, type ChipProps } from '@mui/material';

const statusLabels: Record<string, string> = {
  ACTIVE: 'Ativo',
  EXPIRED: 'Expirado',
  TERMINATED: 'Encerrado',
  OPEN: 'Em aberto',
  UNDER_REVIEW: 'Em análise',
  PARTIALLY_PAID: 'Parcialmente paga',
  PAID: 'Paga',
  OVERDUE: 'Vencida',
  SUBMITTED: 'Enviado',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
};

const statusColors: Record<string, ChipProps['color']> = {
  ACTIVE: 'success',
  PAID: 'success',
  APPROVED: 'success',
  UNDER_REVIEW: 'warning',
  SUBMITTED: 'warning',
  PARTIALLY_PAID: 'info',
  OPEN: 'default',
  EXPIRED: 'default',
  TERMINATED: 'default',
  OVERDUE: 'error',
  REJECTED: 'error',
};

export function StatusChip({ status }: { status: string }) {
  return (
    <Chip
      label={statusLabels[status] ?? status}
      color={statusColors[status] ?? 'default'}
      size="small"
    />
  );
}
