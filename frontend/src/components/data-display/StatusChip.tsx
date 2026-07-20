import { Box } from '@mui/material';
import { statusTones, type StatusTone } from '../../app/theme/theme';

const statusLabels: Record<string, string> = {
  ACTIVE: 'Ativo',
  EXPIRED: 'Expirado',
  TERMINATED: 'Encerrado',
  PENDING_SIGNATURE: 'Pendente de assinatura',
  PAYMENT_PENDING: 'Pagamento pendente',
  ENDING: 'Em encerramento',
  CANCELLED: 'Cancelado',
  OPEN: 'Em aberto',
  UNDER_REVIEW: 'Em análise',
  PARTIALLY_PAID: 'Parcialmente paga',
  PAID: 'Paga',
  OVERDUE: 'Vencida',
  SUBMITTED: 'Enviado',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  REVERSED: 'Estornado',
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
  PENDING_SIGNATURE: 'info',
  PAYMENT_PENDING: 'warning',
  ENDING: 'warning',
  CANCELLED: 'neutral',
  OVERDUE: 'error',
  REJECTED: 'error',
  REVERSED: 'error',
};

export function StatusChip({ status }: { status: string }) {
  const tone = statusTones[statusTone[status] ?? 'neutral'];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 24,
        px: 1,
        borderRadius: '3px',
        border: `1px solid ${tone.dot}80`,
        fontSize: '0.7rem',
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: tone.fg,
        whiteSpace: 'nowrap',
      }}
    >
      {statusLabels[status] ?? status}
    </Box>
  );
}

/**
 * Carimbo para pagamento aprovado / fatura quitada nas telas de detalhe e revisão.
 * `animate` assenta o carimbo uma única vez (aprovação recém-feita).
 */
export function StatusStamp({
  label = 'Pago',
  animate = false,
}: {
  label?: string;
  animate?: boolean;
}) {
  const tone = statusTones.success;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        fontWeight: 700,
        fontSize: '0.8rem',
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: tone.fg,
        border: `2px solid ${tone.fg}`,
        boxShadow: `inset 0 0 0 1.5px #fff, inset 0 0 0 2.5px ${tone.fg}`,
        borderRadius: '4px',
        px: 1.5,
        py: 0.5,
        transform: 'rotate(-5deg)',
        opacity: 0.9,
        whiteSpace: 'nowrap',
        ...(animate && {
          '@media (prefers-reduced-motion: no-preference)': {
            animation: 'stamp-settle 0.45s cubic-bezier(0.2, 1.4, 0.4, 1) both',
            '@keyframes stamp-settle': {
              from: { transform: 'rotate(-11deg) scale(1.5)', opacity: 0 },
              to: { transform: 'rotate(-5deg) scale(1)', opacity: 0.9 },
            },
          },
        }),
      }}
    >
      {label}
    </Box>
  );
}
