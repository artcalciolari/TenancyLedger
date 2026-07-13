import { RefreshOutlined } from '@mui/icons-material';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { queryKeys } from '../../api/query-keys';
import { PageHeader } from '../../components/data-display/PageHeader';
import { PaginationBar } from '../../components/data-display/PaginationBar';
import { EmptyState, LoadingState } from '../../components/feedback/QueryState';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { formatCompetence, formatDateTime } from '../../lib/dates/dates';
import { formatCents } from '../../lib/money/money';
import { invoicesApi } from './api';
import { paymentMethodLabels } from './labels';
import { PaymentProofButton } from './PaymentProofButton';
import { ReviewPaymentActions } from './ReviewPaymentActions';

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function ReviewPaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = positiveInt(searchParams.get('page'), 1);
  const limit = Math.min(100, positiveInt(searchParams.get('limit'), 20));
  const query = useQuery({
    queryKey: queryKeys.paymentReview(page, limit),
    queryFn: () => invoicesApi.list({ page, limit, status: 'UNDER_REVIEW' }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchInterval: () => (document.visibilityState === 'visible' ? 30_000 : false),
  });

  return (
    <>
      <PageHeader
        title="Revisão de pagamentos"
        description="A fila é paginada por fatura e atualizada enquanto esta página estiver visível."
      >
        <Button
          variant="outlined"
          startIcon={<RefreshOutlined />}
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          Atualizar
        </Button>
      </PageHeader>
      {query.isPending ? (
        <LoadingState label="Carregando pagamentos…" />
      ) : query.isError ? (
        <ProblemAlert error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState title="Fila em dia" description="Não há pagamentos aguardando revisão." />
      ) : (
        <Stack spacing={2}>
          {query.data.data.map((invoice) => {
            const submitted = invoice.payments.filter((payment) => payment.status === 'SUBMITTED');
            return (
              <Paper key={invoice.id} sx={{ p: 2.5 }}>
                <Typography component="h2" variant="h2">
                  Fatura {formatCompetence(invoice.competence)}
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  Contrato {invoice.contractId.slice(0, 8)}… · {submitted.length} pagamento(s)
                  pendente(s)
                </Typography>
                <Stack spacing={2}>
                  {submitted.map((payment) => (
                    <Box
                      key={payment.id}
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 2,
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'minmax(220px,1fr) auto auto' },
                        alignItems: { md: 'center' },
                        gap: 2,
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 700 }}>
                          {formatCents(payment.amountCents)} · {paymentMethodLabels[payment.method]}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Enviado em {formatDateTime(payment.submittedAt)}
                        </Typography>
                      </Box>
                      {payment.hasProof ? (
                        <PaymentProofButton invoiceId={invoice.id} paymentId={payment.id} />
                      ) : (
                        <Alert severity="info">Sem comprovante digital</Alert>
                      )}
                      <ReviewPaymentActions
                        invoiceId={invoice.id}
                        paymentId={payment.id}
                        amountCents={payment.amountCents}
                      />
                    </Box>
                  ))}
                </Stack>
              </Paper>
            );
          })}
          <Paper>
            <PaginationBar
              meta={query.data.meta}
              onChange={(nextPage, nextLimit) =>
                setSearchParams({ page: String(nextPage), limit: String(nextLimit) })
              }
            />
          </Paper>
        </Stack>
      )}
    </>
  );
}
