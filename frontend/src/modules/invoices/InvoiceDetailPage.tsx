import {
  AccountBalanceOutlined,
  AddOutlined,
  ArrowBackOutlined,
  CodeOutlined,
  ContentCopyOutlined,
  DescriptionOutlined,
  PaymentsOutlined,
  QrCode2Outlined,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  Divider,
  IconButton,
  Stack,
  Typography,
  type SvgIconProps,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState, type ComponentType } from 'react';
import { Link as RouterLink, useParams } from 'react-router';
import type { PaymentMethod } from '../../api/contract';
import { queryKeys } from '../../api/query-keys';
import { brand, statusTones } from '../../app/theme/theme';
import { StatusChip } from '../../components/data-display/StatusChip';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { LoadingState } from '../../components/feedback/QueryState';
import { formatCivilDate, formatCompetence, formatDateTime } from '../../lib/dates/dates';
import { availableToSubmit, formatCents } from '../../lib/money/money';
import { MANAGEMENT_ROLES, hasRole } from '../../lib/roles/roles';
import { useAuth } from '../auth/useAuth';
import { unitTypeLabel } from '../properties/labels';
import { civilStatusLabel } from '../tenants/labels';
import { invoicesApi } from './api';
import { paymentMethodLabels, proofTypeLabels } from './labels';
import { PaymentProofButton } from './PaymentProofButton';
import { ReviewPaymentActions } from './ReviewPaymentActions';
import { SubmitPaymentDialog } from './SubmitPaymentDialog';

const paymentMethodVisuals: Record<
  PaymentMethod,
  { Icon: ComponentType<SvgIconProps>; bg: string; fg: string }
> = {
  PIX: { Icon: QrCode2Outlined, bg: statusTones.success.bg, fg: statusTones.success.dot },
  BANK_TRANSFER: {
    Icon: AccountBalanceOutlined,
    bg: statusTones.warning.bg,
    fg: statusTones.warning.dot,
  },
  CASH: { Icon: PaymentsOutlined, bg: brand.accentTint, fg: brand.accent },
};

const uppercaseLabelSx = {
  fontSize: '0.78rem',
  fontWeight: 600,
  letterSpacing: '0.03em',
  textTransform: 'uppercase' as const,
};

const heroValueSx = {
  fontFamily: '"Newsreader", Georgia, serif',
  fontSize: '1.9rem',
  fontWeight: 500,
  mt: 1,
};

export function InvoiceDetailPage() {
  const { invoiceId = '' } = useParams();
  const { session } = useAuth();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.invoice(invoiceId),
    queryFn: () => invoicesApi.get(invoiceId),
    enabled: Boolean(invoiceId),
    staleTime: 15_000,
  });
  const canManage = Boolean(session && hasRole(session.user.role, MANAGEMENT_ROLES));

  if (query.isPending) return <LoadingState label="Carregando fatura…" />;
  if (query.isError) return <ProblemAlert error={query.error} onRetry={() => query.refetch()} />;

  const invoice = query.data;
  const availableCents = availableToSubmit(invoice.totalValueCents, invoice.payments);

  return (
    <>
      <Stack
        direction="row"
        component={RouterLink}
        to="/invoices"
        spacing={0.75}
        sx={{
          alignItems: 'center',
          width: 'fit-content',
          mb: 1.75,
          color: brand.textSecondary,
          textDecoration: 'none',
          fontSize: '0.88rem',
          fontWeight: 600,
          '&:hover': { color: brand.textPrimary },
        }}
      >
        <ArrowBackOutlined sx={{ fontSize: 19 }} />
        Voltar para faturas
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography component="h1" variant="h1">
              Fatura de {formatCompetence(invoice.competence)}
            </Typography>
            <StatusChip status={invoice.status} />
          </Stack>
          <Typography sx={{ mt: 1, color: brand.textSecondary }}>
            {invoice.contract.propertyUnit.neighborhood} · Unid.{' '}
            {invoice.contract.propertyUnit.unitNumber} · vence em {formatCivilDate(invoice.dueDate)}
          </Typography>
        </Box>
        {canManage && availableCents > 0 && (
          <Button startIcon={<AddOutlined />} onClick={() => setPaymentOpen(true)} sx={{ flexShrink: 0 }}>
            Registrar pagamento
          </Button>
        )}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 2,
          mb: 3,
        }}
      >
        <Card sx={{ p: 2.5 }}>
          <Typography sx={{ ...uppercaseLabelSx, color: brand.textTertiary }}>
            Valor total
          </Typography>
          <Typography sx={{ ...heroValueSx, color: brand.textPrimary }}>
            {formatCents(invoice.totalValueCents)}
          </Typography>
        </Card>
        <Card sx={{ p: 2.5 }}>
          <Typography sx={{ ...uppercaseLabelSx, color: brand.textTertiary }}>
            Aprovado
          </Typography>
          <Typography sx={{ ...heroValueSx, color: statusTones.success.fg }}>
            {formatCents(invoice.approvedAmountCents)}
          </Typography>
        </Card>
        <Card sx={{ p: 2.5, bgcolor: brand.sidebarBg, borderColor: brand.sidebarBg }}>
          <Typography sx={{ ...uppercaseLabelSx, color: 'rgba(255,255,255,0.6)' }}>
            Saldo a pagar
          </Typography>
          <Typography sx={{ ...heroValueSx, color: '#fff' }}>
            {formatCents(invoice.outstandingAmountCents)}
          </Typography>
        </Card>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(280px, 1fr))' },
          gap: 2,
          mb: 3,
        }}
      >
        <Card sx={{ p: { xs: 2.25, sm: 2.75 } }}>
          <Typography component="h2" variant="h2" sx={{ mb: 2 }}>
            Contrato vinculado
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '11px',
                bgcolor: brand.accentTint,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <DescriptionOutlined sx={{ color: brand.accent, fontSize: 22 }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600, color: brand.textPrimary }}>
                {invoice.contract.propertyUnit.neighborhood} · Unid.{' '}
                {invoice.contract.propertyUnit.unitNumber}
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', color: brand.textTertiary }}>
                {unitTypeLabel(invoice.contract.propertyUnit.type)}
              </Typography>
            </Box>
            <Typography
              component={RouterLink}
              to={`/contracts/${invoice.contractId}`}
              sx={{ fontSize: '0.85rem', fontWeight: 600, color: brand.accent, textDecoration: 'none' }}
            >
              Abrir
            </Typography>
          </Stack>
          <Box component="details" sx={{ mt: 2, pt: 1.75, borderTop: `1px solid ${brand.borderRow}` }}>
            <Box
              component="summary"
              sx={{
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: brand.textTertiary,
                listStyle: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                '&::-webkit-details-marker': { display: 'none' },
              }}
            >
              <CodeOutlined sx={{ fontSize: 18 }} /> Dados técnicos
            </Box>
            <Stack
              direction="row"
              spacing={1}
              sx={{
                mt: 1.25,
                alignItems: 'center',
                bgcolor: brand.surfaceSubtle,
                border: `1px solid ${brand.borderCard}`,
                borderRadius: '9px',
                px: 1.5,
                py: 1,
              }}
            >
              <Typography
                sx={{
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: '0.78rem',
                  color: brand.textSecondary,
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {invoice.contractId}
              </Typography>
              <IconButton
                size="small"
                aria-label="Copiar ID do contrato"
                onClick={() => navigator.clipboard.writeText(invoice.contractId)}
              >
                <ContentCopyOutlined fontSize="small" />
              </IconButton>
            </Stack>
          </Box>
        </Card>

        <Card sx={{ p: { xs: 2.25, sm: 2.75 } }}>
          <Typography component="h2" variant="h2" sx={{ mb: 2 }}>
            Locatário
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                bgcolor: brand.sidebarBg,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {invoice.contract.tenant.name.charAt(0).toUpperCase()}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600, color: brand.textPrimary }}>
                {invoice.contract.tenant.name}
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', color: brand.textTertiary }}>
                CPF {invoice.contract.tenant.cpf} ·{' '}
                {civilStatusLabel(invoice.contract.tenant.civilStatus)}
              </Typography>
            </Box>
            <Typography
              component={RouterLink}
              to={`/tenants/${invoice.contract.tenantId}`}
              sx={{ fontSize: '0.85rem', fontWeight: 600, color: brand.accent, textDecoration: 'none' }}
            >
              Abrir
            </Typography>
          </Stack>
          <Typography
            sx={{
              mt: 2,
              pt: 1.75,
              borderTop: `1px solid ${brand.borderRow}`,
              fontSize: '0.84rem',
              color: brand.textSecondary,
            }}
          >
            Atualizada em {formatDateTime(invoice.updatedAt)}
          </Typography>
        </Card>
      </Box>

      <Typography component="h2" variant="h2" sx={{ mb: 2 }}>
        Pagamentos
      </Typography>
      {invoice.payments.length === 0 ? (
        <Alert severity="info">Nenhum pagamento foi submetido para esta fatura.</Alert>
      ) : (
        <Stack spacing={1.5}>
          {invoice.payments.map((payment) => {
            const visual = paymentMethodVisuals[payment.method];
            const showActions =
              canManage &&
              payment.status === 'SUBMITTED' &&
              payment.submittedByUserId !== session?.user.id;
            const showOwnWarning =
              canManage &&
              payment.status === 'SUBMITTED' &&
              payment.submittedByUserId === session?.user.id;
            return (
              <Card key={payment.id} sx={{ p: { xs: 2, sm: 2.5 } }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  sx={{ alignItems: { md: 'center' } }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: '11px',
                      bgcolor: visual.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <visual.Icon sx={{ color: visual.fg, fontSize: 22 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontFamily: '"Newsreader", Georgia, serif',
                        fontSize: '1.3rem',
                        fontWeight: 500,
                        color: brand.textPrimary,
                      }}
                    >
                      {formatCents(payment.amountCents)}
                    </Typography>
                    <Typography sx={{ fontSize: '0.83rem', color: brand.textTertiary }}>
                      {paymentMethodLabels[payment.method]} · enviado em{' '}
                      {formatDateTime(payment.submittedAt)}
                    </Typography>
                    {payment.proofType && (
                      <Typography sx={{ fontSize: '0.78rem', color: brand.textTertiary, mt: 0.25 }}>
                        {proofTypeLabels[payment.proofType]}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    {payment.hasProof && (
                      <PaymentProofButton invoiceId={invoice.id} paymentId={payment.id} />
                    )}
                    <StatusChip status={payment.status} />
                  </Stack>
                </Stack>
                {showActions && (
                  <Box
                    sx={{
                      mt: 2,
                      pt: 2,
                      borderTop: `1px solid ${brand.borderRow}`,
                      display: 'flex',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <ReviewPaymentActions
                      invoiceId={invoice.id}
                      paymentId={payment.id}
                      amountCents={payment.amountCents}
                      method={payment.method}
                      competence={invoice.competence}
                    />
                  </Box>
                )}
                {showOwnWarning && (
                  <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${brand.borderRow}` }}>
                    <Alert severity="warning">
                      Revisão indisponível: você enviou este pagamento.
                    </Alert>
                  </Box>
                )}
                {payment.rejectionReason && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography sx={{ color: statusTones.error.fg }}>
                      Motivo: {payment.rejectionReason}
                    </Typography>
                  </>
                )}
              </Card>
            );
          })}
        </Stack>
      )}
      <SubmitPaymentDialog
        invoiceId={invoice.id}
        availableCents={availableCents}
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
      />
    </>
  );
}
