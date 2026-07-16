import {
  ChevronRightOutlined,
  ClearOutlined,
  SearchOutlined,
  TuneOutlined,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type InvoiceListFilters,
  type InvoiceStatus,
} from '../../api/contract';
import { queryKeys } from '../../api/query-keys';
import { brand } from '../../app/theme/theme';
import { PageHeader } from '../../components/data-display/PageHeader';
import { PaginationBar } from '../../components/data-display/PaginationBar';
import {
  type ListSearchConfig,
  useListPageRange,
  useListSearchParams,
} from '../../components/data-display/useListSearchParams';
import { StatusChip } from '../../components/data-display/StatusChip';
import { CsvExportButton } from '../../components/data-display/CsvExportButton';
import { EmptyState, LoadingState } from '../../components/feedback/QueryState';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { formatCivilDate, formatCompetence } from '../../lib/dates/dates';
import { isUuidV4 } from '../../lib/identifiers/uuid';
import { formatCents } from '../../lib/money/money';
import { invoicesApi } from './api';
import { parseInvoiceFilters } from './filters';
import { paymentMethodLabels, paymentStatusLabels } from './labels';

const statusChipOptions: { label: string; value: InvoiceStatus | undefined }[] = [
  { label: 'Todas', value: undefined },
  { label: 'Em aberto', value: 'OPEN' },
  { label: 'Vencidas', value: 'OVERDUE' },
  { label: 'Em análise', value: 'UNDER_REVIEW' },
  { label: 'Pagas', value: 'PAID' },
];

const invoiceSearchConfig: ListSearchConfig<InvoiceListFilters> = {
  filterKeys: [
    'status',
    'competence',
    'contractId',
    'q',
    'dueFrom',
    'dueTo',
    'tenantId',
    'propertyUnitId',
    'paymentMethod',
    'paymentStatus',
  ],
  parse: (searchParams, page, limit) => ({
    ...parseInvoiceFilters(searchParams),
    page,
    limit,
  }),
};

function AdvancedInvoiceFilters({
  filters,
  onApply,
}: {
  filters: InvoiceListFilters;
  onApply: (values: Record<string, string | undefined>) => void;
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (key: string) => {
      const raw = data.get(key);
      if (typeof raw !== 'string') return undefined;
      const normalized = raw.trim();
      return normalized === '' ? undefined : normalized;
    };
    onApply({
      dueFrom: value('dueFrom'),
      dueTo: value('dueTo'),
      paymentMethod: value('paymentMethod'),
      paymentStatus: value('paymentStatus'),
    });
  };

  return (
    <Box
      component="form"
      onSubmit={submit}
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' },
      }}
    >
      <TextField
        name="dueFrom"
        label="Vencimento a partir de"
        type="date"
        defaultValue={filters.dueFrom ?? ''}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        name="dueTo"
        label="Vencimento até"
        type="date"
        defaultValue={filters.dueTo ?? ''}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <FormControl>
        <InputLabel id="invoice-payment-method-filter">Método</InputLabel>
        <Select
          name="paymentMethod"
          labelId="invoice-payment-method-filter"
          label="Método"
          defaultValue={filters.paymentMethod ?? ''}
        >
          <MenuItem value="">Todos</MenuItem>
          {PAYMENT_METHODS.map((method) => (
            <MenuItem key={method} value={method}>
              {paymentMethodLabels[method]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl>
        <InputLabel id="invoice-payment-status-filter">Pagamento</InputLabel>
        <Select
          name="paymentStatus"
          labelId="invoice-payment-status-filter"
          label="Pagamento"
          defaultValue={filters.paymentStatus ?? ''}
        >
          <MenuItem value="">Todos</MenuItem>
          {PAYMENT_STATUSES.map((status) => (
            <MenuItem key={status} value={status}>
              {paymentStatusLabels[status]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Button type="submit" variant="outlined" sx={{ alignSelf: 'flex-start' }}>
        Aplicar filtros avançados
      </Button>
    </Box>
  );
}

function ContractIdFilter({
  initialValue,
  onApply,
  onClear,
}: {
  initialValue: string;
  onApply: (value: string | undefined) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState(initialValue);
  const [error, setError] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = draft.trim();
    if (value && !isUuidV4(value)) {
      setError('Informe um UUID v4 completo.');
      return;
    }
    setError('');
    onApply(value || undefined);
  };

  return (
    <Stack
      component="form"
      direction={{ xs: 'column', md: 'row' }}
      spacing={1}
      onSubmit={submit}
      noValidate
      sx={{ flex: 1, minWidth: { md: 280 } }}
    >
      <TextField
        label="ID do contrato"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          if (error) setError('');
        }}
        error={Boolean(error)}
        helperText={error || 'UUID v4 completo'}
        sx={{ flex: 1 }}
      />
      <Button type="submit" variant="outlined">
        Aplicar
      </Button>
      <Button
        type="button"
        variant="text"
        startIcon={<ClearOutlined />}
        onClick={() => {
          setDraft('');
          setError('');
          onClear();
        }}
      >
        Limpar
      </Button>
    </Stack>
  );
}

export function InvoiceListPage() {
  const navigate = useNavigate();
  const listParams = useListSearchParams(invoiceSearchConfig);
  const { clearFilters, filters, searchParamsKey, updateFilters } = listParams;
  const query = useQuery({
    queryKey: queryKeys.invoices(filters),
    queryFn: () => invoicesApi.list(filters),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
  const pageOutOfRange = useListPageRange(listParams, query.data?.meta.totalPages, {
    resetTo: 'last',
    preserveLimitParam: true,
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState(filters.q ?? '');
  const [lastSyncedQ, setLastSyncedQ] = useState(filters.q ?? '');
  if (lastSyncedQ !== (filters.q ?? '')) {
    setLastSyncedQ(filters.q ?? '');
    setSearchDraft(filters.q ?? '');
  }

  // Aplica a busca com um pequeno atraso, sem alterar a forma como o filtro é consultado.
  useEffect(() => {
    const trimmed = searchDraft.trim();
    if (trimmed === (filters.q ?? '')) return;
    const timeout = window.setTimeout(() => {
      updateFilters({ q: trimmed || undefined });
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [filters.q, searchDraft, updateFilters]);

  return (
    <>
      <PageHeader
        title="Faturas"
        description="Consulte as cobranças geradas automaticamente pelo sistema."
      >
        <CsvExportButton exportCsv={() => invoicesApi.exportCsv(filters)} filename="faturas.csv" />
      </PageHeader>
      <Card sx={{ p: 2, mb: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <TextField
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Buscar por bairro, unidade, CPF ou profissão"
            aria-label="Buscar fatura"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined sx={{ color: brand.textTertiary, fontSize: 20 }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              flex: 1,
              minWidth: 260,
              '& .MuiOutlinedInput-root': { bgcolor: brand.surfaceSubtle, borderRadius: '12px' },
            }}
          />
          <TextField
            label="Mês de referência"
            type="month"
            value={filters.competence ?? ''}
            onChange={(event) => updateFilters({ competence: event.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ maxWidth: { md: 220 } }}
          />
          <Button
            type="button"
            variant="outlined"
            startIcon={<TuneOutlined />}
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((open) => !open)}
            sx={{
              bgcolor: 'background.paper',
              borderColor: brand.borderInput,
              color: brand.textPrimary,
              whiteSpace: 'nowrap',
            }}
          >
            Filtros avançados
          </Button>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mt: 1.75 }}>
          {statusChipOptions.map((option) => {
            const active = (filters.status ?? undefined) === option.value;
            return (
              <Chip
                key={option.label}
                clickable
                label={option.label}
                onClick={() => updateFilters({ status: option.value })}
                variant={active ? 'filled' : 'outlined'}
                sx={{
                  height: 34,
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  bgcolor: active ? 'primary.main' : 'background.paper',
                  color: active ? '#fff' : brand.textPrimary,
                  borderColor: active ? 'primary.main' : brand.borderInput,
                  '&:hover': { bgcolor: active ? 'primary.dark' : brand.surfaceSubtle },
                }}
              />
            );
          })}
        </Stack>
        {advancedOpen && (
          <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${brand.borderRow}` }}>
            <Stack spacing={2}>
              <ContractIdFilter
                key={filters.contractId ?? ''}
                initialValue={filters.contractId ?? ''}
                onApply={(contractId) => updateFilters({ contractId })}
                onClear={clearFilters}
              />
              <AdvancedInvoiceFilters
                key={`advanced-${searchParamsKey}`}
                filters={filters}
                onApply={(values) => updateFilters(values)}
              />
            </Stack>
          </Box>
        )}
      </Card>
      {query.isPending || pageOutOfRange ? (
        <LoadingState label="Carregando faturas…" />
      ) : query.isError ? (
        <ProblemAlert error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          title="Nenhuma fatura encontrada"
          description={
            Object.entries(filters).some(
              ([key, value]) => !['page', 'limit'].includes(key) && Boolean(value),
            )
              ? 'Ajuste os filtros para tentar novamente.'
              : 'As faturas aparecerão após a geração automática.'
          }
        />
      ) : (
        <Stack spacing={2}>
          {/* Mobile card list — mesma quebra responsiva (apenas xs) preservada */}
          <Stack spacing={1.5} sx={{ display: { xs: 'flex', sm: 'none' } }}>
            {query.data.data.map((invoice) => (
              <Card key={invoice.id}>
                <CardContent>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
                    <Box>
                      <Typography sx={{ fontSize: '0.78rem', color: brand.textTertiary }}>
                        Mês ref. {formatCompetence(invoice.competence)}
                      </Typography>
                      <Typography
                        sx={{ fontSize: '1rem', fontWeight: 700, color: brand.textPrimary }}
                      >
                        {invoice.contract.propertyUnit.neighborhood} · Unid.{' '}
                        {invoice.contract.propertyUnit.unitNumber}
                      </Typography>
                      <Typography sx={{ fontSize: '0.79rem', color: brand.textTertiary }}>
                        {invoice.contract.tenant.name} · CPF {invoice.contract.tenant.cpf}
                      </Typography>
                    </Box>
                    <StatusChip status={invoice.status} />
                  </Stack>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Vencimento
                      </Typography>
                      <Typography sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatCivilDate(invoice.dueDate)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Total
                      </Typography>
                      <Typography sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatCents(invoice.totalValueCents)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Saldo
                      </Typography>
                      <Typography
                        sx={{
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: invoice.outstandingAmountCents > 0 ? 700 : 400,
                          color:
                            invoice.outstandingAmountCents > 0
                              ? brand.textPrimary
                              : brand.textTertiary,
                        }}
                      >
                        {formatCents(invoice.outstandingAmountCents)}
                      </Typography>
                    </Box>
                  </Box>
                  <Button
                    component={RouterLink}
                    to={`/invoices/${invoice.id}`}
                    variant="outlined"
                    fullWidth
                    sx={{ mt: 2 }}
                  >
                    Abrir fatura
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Stack>
          <Card sx={{ display: { xs: 'none', sm: 'block' }, p: 0 }}>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table sx={{ minWidth: 760 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Fatura</TableCell>
                    <TableCell>Mês ref.</TableCell>
                    <TableCell>Vencimento</TableCell>
                    <TableCell align="right">Valor</TableCell>
                    <TableCell align="right">Saldo</TableCell>
                    <TableCell>Situação</TableCell>
                    <TableCell sx={{ width: 44 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {query.data.data.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      hover
                      onClick={() => void navigate(`/invoices/${invoice.id}`)}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: brand.surfaceSubtle } }}
                    >
                      <TableCell>
                        <Typography
                          component={RouterLink}
                          to={`/invoices/${invoice.id}`}
                          sx={{
                            display: 'block',
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            color: brand.textPrimary,
                            textDecoration: 'none',
                          }}
                        >
                          {invoice.contract.propertyUnit.neighborhood} · Unid.{' '}
                          {invoice.contract.propertyUnit.unitNumber}
                        </Typography>
                        <Typography
                          sx={{ fontSize: '0.8rem', color: brand.textTertiary, mt: 0.25 }}
                        >
                          {invoice.contract.tenant.name} · CPF {invoice.contract.tenant.cpf}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatCompetence(invoice.competence)}</TableCell>
                      <TableCell>{formatCivilDate(invoice.dueDate)}</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatCents(invoice.totalValueCents)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: invoice.outstandingAmountCents > 0 ? 700 : 400,
                          color:
                            invoice.outstandingAmountCents > 0
                              ? brand.textPrimary
                              : brand.textTertiary,
                        }}
                      >
                        {formatCents(invoice.outstandingAmountCents)}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={invoice.status} />
                      </TableCell>
                      <TableCell align="right" sx={{ color: brand.borderInput }}>
                        <ChevronRightOutlined />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ bgcolor: brand.surfaceSubtle, borderTop: `1px solid ${brand.borderCard}` }}>
              <PaginationBar
                meta={query.data.meta}
                onChange={(page, limit) => updateFilters({ page, limit })}
              />
            </Box>
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
