import { ClearOutlined } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
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
import { Link as RouterLink, useSearchParams } from 'react-router';
import {
  INVOICE_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type InvoiceListFilters,
} from '../../api/contract';
import { queryKeys } from '../../api/query-keys';
import { PageHeader } from '../../components/data-display/PageHeader';
import { PaginationBar } from '../../components/data-display/PaginationBar';
import { StatusChip } from '../../components/data-display/StatusChip';
import { CsvExportButton } from '../../components/data-display/CsvExportButton';
import { EmptyState, LoadingState } from '../../components/feedback/QueryState';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { formatCivilDate, formatCompetence } from '../../lib/dates/dates';
import { isUuidV4 } from '../../lib/identifiers/uuid';
import { formatCents } from '../../lib/money/money';
import { clampPage } from '../../lib/pagination/pagination';
import { invoicesApi } from './api';
import { parseInvoiceFilters } from './filters';
import { invoiceStatusLabels, paymentMethodLabels, paymentStatusLabels } from './labels';

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
      q: value('q'),
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
        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)', xl: 'repeat(6, 1fr)' },
        mt: 2,
      }}
    >
      <TextField
        name="q"
        label="Buscar fatura"
        defaultValue={filters.q ?? ''}
        helperText="CPF, profissão, bairro ou unidade"
        sx={{ gridColumn: { xl: 'span 2' } }}
      />
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
        Aplicar busca avançada
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
      sx={{ flex: 1 }}
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
      <Button type="submit">Aplicar</Button>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseInvoiceFilters(searchParams);
  const query = useQuery({
    queryKey: queryKeys.invoices(filters),
    queryFn: () => invoicesApi.list(filters),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
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
      status: filters.status,
      competence: filters.competence,
      contractId: filters.contractId,
      q: filters.q,
      dueFrom: filters.dueFrom,
      dueTo: filters.dueTo,
      tenantId: filters.tenantId,
      propertyUnitId: filters.propertyUnitId,
      paymentMethod: filters.paymentMethod,
      paymentStatus: filters.paymentStatus,
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
    filters.contractId,
    filters.dueFrom,
    filters.dueTo,
    filters.limit,
    filters.page,
    filters.paymentMethod,
    filters.paymentStatus,
    filters.propertyUnitId,
    filters.q,
    filters.status,
    filters.tenantId,
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

  const clearFilters = () => {
    setSearchParams({ page: '1', limit: String(filters.limit) });
  };

  return (
    <>
      <PageHeader
        title="Faturas"
        description="Consulte as cobranças geradas automaticamente pelo sistema."
      >
        <CsvExportButton exportCsv={() => invoicesApi.exportCsv(filters)} filename="faturas.csv" />
      </PageHeader>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ alignItems: { md: 'flex-start' } }}
        >
          <TextField
            label="Competência"
            type="month"
            value={filters.competence ?? ''}
            onChange={(event) => update({ competence: event.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ maxWidth: { md: 220 } }}
          />
          <FormControl size="small" fullWidth sx={{ maxWidth: { md: 240 } }}>
            <InputLabel id="invoice-status-filter">Status</InputLabel>
            <Select
              labelId="invoice-status-filter"
              label="Status"
              value={filters.status ?? ''}
              onChange={(event) => update({ status: event.target.value })}
            >
              <MenuItem value="">Todos</MenuItem>
              {INVOICE_STATUSES.map((status) => (
                <MenuItem value={status} key={status}>
                  {invoiceStatusLabels[status]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <ContractIdFilter
            key={filters.contractId ?? ''}
            initialValue={filters.contractId ?? ''}
            onApply={(contractId) => update({ contractId })}
            onClear={clearFilters}
          />
        </Stack>
        <AdvancedInvoiceFilters
          key={`advanced-${searchParams.toString()}`}
          filters={filters}
          onApply={update}
        />
      </Paper>
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
          <Stack spacing={1.5} sx={{ display: { xs: 'flex', sm: 'none' } }}>
            {query.data.data.map((invoice) => (
              <Card variant="outlined" key={invoice.id}>
                <CardContent>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1, mb: 2 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Competência
                      </Typography>
                      <Typography component="h2" variant="h2" sx={{ fontSize: '1.15rem' }}>
                        {formatCompetence(invoice.competence)}
                      </Typography>
                    </Box>
                    <StatusChip status={invoice.status} />
                  </Stack>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 1.5,
                    }}
                  >
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Vencimento
                      </Typography>
                      <Typography>{formatCivilDate(invoice.dueDate)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Contrato
                      </Typography>
                      <Typography sx={{ fontFamily: 'monospace' }}>
                        {invoice.contractId.slice(0, 8)}…
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {invoice.contract.tenant.cpf} · {invoice.contract.propertyUnit.neighborhood}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Total
                      </Typography>
                      <Typography>{formatCents(invoice.totalValueCents)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Aprovado
                      </Typography>
                      <Typography>{formatCents(invoice.approvedAmountCents)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Saldo
                      </Typography>
                      <Typography>{formatCents(invoice.outstandingAmountCents)}</Typography>
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
          <Paper sx={{ display: { xs: 'none', sm: 'block' } }}>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table sx={{ minWidth: 760 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Competência</TableCell>
                    <TableCell>Vencimento</TableCell>
                    <TableCell>Contrato e vínculo</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">Aprovado</TableCell>
                    <TableCell align="right">Saldo</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Ação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {query.data.data.map((invoice) => (
                    <TableRow key={invoice.id} hover>
                      <TableCell>{formatCompetence(invoice.competence)}</TableCell>
                      <TableCell>{formatCivilDate(invoice.dueDate)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {invoice.contractId.slice(0, 8)}…
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {invoice.contract.tenant.cpf} ·{' '}
                          {invoice.contract.propertyUnit.neighborhood}, unidade{' '}
                          {invoice.contract.propertyUnit.unitNumber}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{formatCents(invoice.totalValueCents)}</TableCell>
                      <TableCell align="right">
                        {formatCents(invoice.approvedAmountCents)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCents(invoice.outstandingAmountCents)}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={invoice.status} />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          component={RouterLink}
                          to={`/invoices/${invoice.id}`}
                          variant="text"
                        >
                          Abrir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
          <Paper>
            <PaginationBar
              meta={query.data.meta}
              onChange={(page, limit) => update({ page, limit })}
            />
          </Paper>
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
