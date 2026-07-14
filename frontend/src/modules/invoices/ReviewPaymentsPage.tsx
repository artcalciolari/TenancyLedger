import AutorenewOutlinedIcon from '@mui/icons-material/AutorenewOutlined';
import ClearOutlinedIcon from '@mui/icons-material/ClearOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import {
  PAYMENT_METHODS,
  type PaymentMethod,
  type PaymentReviewFilters,
  type PaymentReviewItem,
} from '../../api/contract';
import { queryKeys } from '../../api/query-keys';
import { brand } from '../../app/theme/theme';
import { PageHeader } from '../../components/data-display/PageHeader';
import { PaginationBar } from '../../components/data-display/PaginationBar';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { EmptyState, LoadingState } from '../../components/feedback/QueryState';
import { formatCompetence, formatDateTime } from '../../lib/dates/dates';
import { formatCents } from '../../lib/money/money';
import { clampPage } from '../../lib/pagination/pagination';
import { useAuth } from '../auth/useAuth';
import { invoicesApi } from './api';
import { paymentMethodLabels } from './labels';
import { PaymentProofButton } from './PaymentProofButton';
import { ReviewPaymentActions } from './ReviewPaymentActions';

const allowedLimits = new Set([20, 50, 100]);

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function nonEmpty(value: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized === undefined || normalized === '' ? undefined : normalized;
}

function competence(value: string | null): string | undefined {
  const normalized = nonEmpty(value);
  return normalized && /^\d{4}-(0[1-9]|1[0-2])$/.test(normalized) ? normalized : undefined;
}

function civilDate(value: string | null): string | undefined {
  const normalized = nonEmpty(value);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return undefined;
  const [year, month, day] = normalized.split('-').map(Number);
  const parsed = new Date(Date.UTC(year ?? 0, (month ?? 0) - 1, day ?? 0));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === (month ?? 0) - 1 &&
    parsed.getUTCDate() === day
    ? normalized
    : undefined;
}

function parseFilters(search: URLSearchParams): PaymentReviewFilters {
  const rawLimit = positiveInt(search.get('limit'), 20);
  const rawMethod = search.get('method');
  return {
    page: positiveInt(search.get('page'), 1),
    limit: allowedLimits.has(rawLimit) ? rawLimit : 20,
    q: nonEmpty(search.get('q')?.slice(0, 120) ?? null),
    competence: competence(search.get('competence')),
    method: PAYMENT_METHODS.includes(rawMethod as PaymentMethod)
      ? (rawMethod as PaymentMethod)
      : undefined,
    submittedFrom: civilDate(search.get('submittedFrom')),
    submittedTo: civilDate(search.get('submittedTo')),
  };
}

function groupByInvoice(items: PaymentReviewItem[]): PaymentReviewItem[][] {
  const groups = new Map<string, PaymentReviewItem[]>();
  items.forEach((item) => {
    const group = groups.get(item.invoice.id) ?? [];
    group.push(item);
    groups.set(item.invoice.id, group);
  });
  return [...groups.values()];
}

export function ReviewPaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseFilters(searchParams);
  const { session } = useAuth();
  const query = useQuery({
    queryKey: queryKeys.paymentReview(filters),
    queryFn: () => invoicesApi.review(filters),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchInterval: () => (document.visibilityState === 'visible' ? 30_000 : false),
  });
  const normalizedPage = query.data
    ? clampPage(filters.page, query.data.meta.totalPages)
    : filters.page;
  const pageOutOfRange = normalizedPage !== filters.page;

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    const normalized: Record<string, string | undefined> = {
      page: searchParams.has('page') || pageOutOfRange ? String(normalizedPage) : undefined,
      limit: searchParams.has('limit') ? String(filters.limit) : undefined,
      q: filters.q,
      competence: filters.competence,
      method: filters.method,
      submittedFrom: filters.submittedFrom,
      submittedTo: filters.submittedTo,
    };
    Object.entries(normalized).forEach(([key, value]) => {
      const current = next.get(key);
      if (current !== null && value === undefined) {
        next.delete(key);
        changed = true;
      } else if (value !== undefined && current !== value) {
        next.set(key, value);
        changed = true;
      }
    });
    if (changed) setSearchParams(next, { replace: true });
  }, [
    filters.competence,
    filters.limit,
    filters.method,
    filters.page,
    filters.q,
    filters.submittedFrom,
    filters.submittedTo,
    normalizedPage,
    pageOutOfRange,
    searchParams,
    setSearchParams,
  ]);

  const update = (values: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(values).forEach(([key, value]) => {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    if (!Object.hasOwn(values, 'page')) next.set('page', '1');
    setSearchParams(next);
  };

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (key: string) => {
      const raw = data.get(key);
      if (typeof raw !== 'string') return undefined;
      return nonEmpty(raw);
    };
    update({
      q: value('q'),
      competence: value('competence'),
      method: value('method'),
      submittedFrom: value('submittedFrom'),
      submittedTo: value('submittedTo'),
    });
  };

  const groups = groupByInvoice(query.data?.data ?? []);

  return (
    <>
      <PageHeader
        title="Revisão de pagamentos"
        description="Aprove ou recuse os pagamentos enviados pelos locatários."
      >
        <Button
          variant="outlined"
          startIcon={<RefreshOutlinedIcon />}
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          sx={{ borderColor: brand.borderInput, color: brand.textPrimary, bgcolor: 'background.paper' }}
        >
          Atualizar
        </Button>
      </PageHeader>
      <Stack
        direction="row"
        spacing={1.25}
        sx={{
          alignItems: 'center',
          bgcolor: brand.accentTint,
          border: `1px solid ${brand.accentTint}`,
          borderRadius: '12px',
          px: 2,
          py: 1.5,
          mb: 2,
          color: brand.accentDark,
          fontSize: '0.88rem',
        }}
      >
        <AutorenewOutlinedIcon sx={{ fontSize: 20 }} />
        <Typography sx={{ fontSize: 'inherit', color: 'inherit' }}>
          A fila é paginada por pagamento e atualiza sozinha a cada 30 segundos enquanto esta tela
          estiver aberta.
        </Typography>
      </Stack>
      <Card component="form" onSubmit={applyFilters} key={searchParams.toString()} sx={{ mb: 2, p: 2 }}>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)', xl: 'repeat(6, 1fr)' },
          }}
        >
          <TextField
            name="q"
            label="Buscar pagamento"
            defaultValue={filters.q ?? ''}
            helperText="CPF, bairro, profissão ou unidade"
            sx={{ gridColumn: { xl: 'span 2' } }}
          />
          <TextField
            name="competence"
            label="Competência"
            type="month"
            defaultValue={filters.competence ?? ''}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <FormControl>
            <InputLabel id="review-method-filter">Método</InputLabel>
            <Select
              name="method"
              labelId="review-method-filter"
              label="Método"
              defaultValue={filters.method ?? ''}
            >
              <MenuItem value="">Todos</MenuItem>
              {PAYMENT_METHODS.map((method) => (
                <MenuItem key={method} value={method}>
                  {paymentMethodLabels[method]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            name="submittedFrom"
            label="Enviado a partir de"
            type="date"
            defaultValue={filters.submittedFrom ?? ''}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            name="submittedTo"
            label="Enviado até"
            type="date"
            defaultValue={filters.submittedTo ?? ''}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button type="submit">Aplicar</Button>
          <Button
            type="button"
            variant="text"
            startIcon={<ClearOutlinedIcon />}
            onClick={() => setSearchParams({ page: '1', limit: String(filters.limit) })}
          >
            Limpar
          </Button>
        </Stack>
      </Card>
      {query.isPending || pageOutOfRange ? (
        <LoadingState label="Carregando pagamentos…" />
      ) : query.isError ? (
        <ProblemAlert error={query.error} onRetry={() => void query.refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState title="Fila em dia" description="Não há pagamentos aguardando revisão." />
      ) : (
        <Stack spacing={1.75}>
          {groups.map((items) => {
            const first = items[0];
            if (!first) return null;
            return (
              <Card key={first.invoice.id} sx={{ p: 0, overflow: 'hidden' }}>
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 2.5,
                    py: 2,
                    bgcolor: brand.surfaceSubtle,
                    borderBottom: `1px solid ${brand.borderCard}`,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: brand.textPrimary }}>
                      Fatura {formatCompetence(first.invoice.competence)} ·{' '}
                      {first.contract.propertyUnit.neighborhood}, unidade{' '}
                      {first.contract.propertyUnit.unitNumber}
                    </Typography>
                    <Typography sx={{ fontSize: '0.82rem', color: brand.textTertiary, mt: 0.25 }}>
                      {first.contract.tenant.name} · CPF {first.contract.tenant.cpf} ·{' '}
                      {items.length} pagamento(s) pendente(s)
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <Typography
                      sx={{
                        fontSize: '0.72rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: brand.textTertiary,
                        fontWeight: 600,
                      }}
                    >
                      Saldo
                    </Typography>
                    <Typography
                      sx={{ fontSize: '0.95rem', fontWeight: 700, color: brand.textPrimary, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatCents(first.invoice.outstandingAmountCents)}
                    </Typography>
                  </Box>
                </Stack>
                <Stack spacing={2} sx={{ p: 2.5 }} divider={<Box sx={{ borderTop: `1px solid ${brand.borderRow}` }} />}>
                  {items.map(({ invoice, payment }) => {
                    const ownSubmission = payment.submittedByUserId === session?.user.id;
                    return (
                      <Box
                        key={payment.id}
                        sx={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: 2,
                        }}
                      >
                        <Box sx={{ flex: '1 1 200px', minWidth: 180 }}>
                          <Typography
                            sx={{
                              fontFamily: '"Newsreader", Georgia, serif',
                              fontSize: '1.35rem',
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
                        </Box>
                        {payment.hasProof ? (
                          <PaymentProofButton invoiceId={invoice.id} paymentId={payment.id} />
                        ) : (
                          <Stack
                            direction="row"
                            spacing={0.75}
                            sx={{ alignItems: 'center', color: brand.textTertiary, fontSize: '0.84rem' }}
                          >
                            <InfoOutlinedIcon sx={{ fontSize: 19 }} />
                            Sem comprovante digital
                          </Stack>
                        )}
                        <Box sx={{ ml: { md: 'auto' } }}>
                          {ownSubmission ? (
                            <Alert severity="warning" sx={{ maxWidth: 300 }}>
                              Você enviou este pagamento, então não pode revisá-lo.
                            </Alert>
                          ) : (
                            <ReviewPaymentActions
                              invoiceId={invoice.id}
                              paymentId={payment.id}
                              amountCents={payment.amountCents}
                              method={payment.method}
                              competence={invoice.competence}
                            />
                          )}
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              </Card>
            );
          })}
          <Card sx={{ p: 0 }}>
            <PaginationBar
              meta={query.data.meta}
              onChange={(page, limit) => update({ page, limit })}
            />
          </Card>
        </Stack>
      )}
      {query.isFetching && !query.isPending && (
        <Box role="status" aria-live="polite" sx={{ mt: 1 }}>
          Atualizando…
        </Box>
      )}
    </>
  );
}
