import { Box } from '@mui/material';
import { statusTones, type StatusTone } from '../../app/theme/theme';

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

const statusTone: Record<string, StatusTone> = {
  ACTIVE: 'success',
  PAID: 'success',
  APPROVED: 'success',
  UNDER_REVIEW: 'warning',
  SUBMITTED: 'warning',
  PARTIALLY_PAID: 'info',
  OPEN: 'neutral',
  EXPIRED: 'neutral',
  TERMINATED: 'neutral',
  OVERDUE: 'error',
  REJECTED: 'error',
};

export function StatusChip({ status }: { status: string }) {
  const tone = statusTones[statusTone[status] ?? 'neutral'];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.85,
        height: 26,
        px: 1.35,
        borderRadius: '8px',
        fontSize: '0.8rem',
        fontWeight: 600,
        bgcolor: tone.bg,
        color: tone.fg,
        whiteSpace: 'nowrap',
      }}
    >
      <Box
        component="span"
        aria-hidden
        sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: tone.dot, flexShrink: 0 }}
      />
      {statusLabels[status] ?? status}
    </Box>
  );
}
