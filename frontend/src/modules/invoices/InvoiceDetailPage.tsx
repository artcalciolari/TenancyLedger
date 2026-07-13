import { ArrowBackOutlined, ContentCopyOutlined } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router';
import { queryKeys } from '../../api/query-keys';
import { PageHeader } from '../../components/data-display/PageHeader';
import { StatusChip } from '../../components/data-display/StatusChip';
import { LoadingState } from '../../components/feedback/QueryState';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { formatCivilDate, formatCompetence, formatDateTime } from '../../lib/dates/dates';
import { availableToSubmit, formatCents } from '../../lib/money/money';
import { MANAGEMENT_ROLES, hasRole } from '../../lib/roles/roles';
import { useAuth } from '../auth/useAuth';
import { invoicesApi } from './api';
import { paymentMethodLabels, proofTypeLabels } from './labels';
import { PaymentProofButton } from './PaymentProofButton';
import { ReviewPaymentActions } from './ReviewPaymentActions';
import { SubmitPaymentDialog } from './SubmitPaymentDialog';

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
      <PageHeader
        title={`Fatura ${formatCompetence(invoice.competence)}`}
        description={`Vencimento em ${formatCivilDate(invoice.dueDate)}`}
      >
        <Button
          component={RouterLink}
          to="/invoices"
          variant="text"
          startIcon={<ArrowBackOutlined />}
        >
          Voltar
        </Button>
        {canManage && availableCents > 0 && (
          <Button onClick={() => setPaymentOpen(true)}>Registrar pagamento</Button>
        )}
      </PageHeader>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          ['Total', formatCents(invoice.totalValueCents)],
          ['Aprovado', formatCents(invoice.approvedAmountCents)],
          ['Saldo', formatCents(invoice.outstandingAmountCents)],
        ].map(([label, value]) => (
          <Grid size={{ xs: 12, sm: 4 }} key={label}>
            <Card variant="outlined">
              <CardContent>
                <Typography color="text.secondary">{label}</Typography>
                <Typography variant="h2">{value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between' }}
        >
          <Box>
            <Typography color="text.secondary" variant="body2">
              Contrato
            </Typography>
            <Stack direction="row" sx={{ alignItems: 'center' }}>
              <Typography
                component={RouterLink}
                to={`/contracts/${invoice.contractId}`}
                sx={{ fontFamily: 'monospace' }}
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
          <Box>
            <Typography color="text.secondary" variant="body2">
              Status
            </Typography>
            <StatusChip status={invoice.status} />
          </Box>
          <Box>
            <Typography color="text.secondary" variant="body2">
              Atualizada
            </Typography>
            <Typography>{formatDateTime(invoice.updatedAt)}</Typography>
          </Box>
        </Stack>
      </Paper>

      <Typography component="h2" variant="h2" sx={{ mb: 2 }}>
        Pagamentos
      </Typography>
      {invoice.payments.length === 0 ? (
        <Alert severity="info">Nenhum pagamento foi submetido para esta fatura.</Alert>
      ) : (
        <Stack spacing={2}>
          {invoice.payments.map((payment) => (
            <Paper key={payment.id} sx={{ p: 2.5 }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                sx={{ justifyContent: 'space-between', alignItems: { md: 'flex-start' } }}
              >
                <Box>
                  <Typography variant="h2">{formatCents(payment.amountCents)}</Typography>
                  <Typography color="text.secondary">
                    {paymentMethodLabels[payment.method]} · enviado em{' '}
                    {formatDateTime(payment.submittedAt)}
                  </Typography>
                  {payment.proofType && (
                    <Typography variant="body2">{proofTypeLabels[payment.proofType]}</Typography>
                  )}
                </Box>
                <StatusChip status={payment.status} />
                {payment.hasProof && (
                  <PaymentProofButton invoiceId={invoice.id} paymentId={payment.id} />
                )}
                {canManage &&
                  payment.status === 'SUBMITTED' &&
                  payment.submittedByUserId !== session?.user.id && (
                    <ReviewPaymentActions
                      invoiceId={invoice.id}
                      paymentId={payment.id}
                      amountCents={payment.amountCents}
                      method={payment.method}
                      competence={invoice.competence}
                    />
                  )}
                {canManage &&
                  payment.status === 'SUBMITTED' &&
                  payment.submittedByUserId === session?.user.id && (
                    <Alert severity="warning">
                      Revisão indisponível: você enviou este pagamento.
                    </Alert>
                  )}
              </Stack>
              {payment.rejectionReason && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography color="error.main">Motivo: {payment.rejectionReason}</Typography>
                </>
              )}
            </Paper>
          ))}
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
