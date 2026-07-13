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
import { Link as RouterLink, useSearchParams } from 'react-router';
import { INVOICE_STATUSES, type InvoiceListFilters, type InvoiceStatus } from '../../api/contract';
import { queryKeys } from '../../api/query-keys';
import { PageHeader } from '../../components/data-display/PageHeader';
import { PaginationBar } from '../../components/data-display/PaginationBar';
import { StatusChip } from '../../components/data-display/StatusChip';
import { EmptyState, LoadingState } from '../../components/feedback/QueryState';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { formatCivilDate, formatCompetence } from '../../lib/dates/dates';
import { formatCents } from '../../lib/money/money';
import { invoicesApi } from './api';
import { invoiceStatusLabels } from './labels';

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function InvoiceListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusValue = searchParams.get('status');
  const competenceValue = searchParams.get('competence');
  const contractIdValue = searchParams.get('contractId');
  const filters: InvoiceListFilters = {
    page: positiveInt(searchParams.get('page'), 1),
    limit: Math.min(100, positiveInt(searchParams.get('limit'), 20)),
    status: INVOICE_STATUSES.includes(statusValue as InvoiceStatus)
      ? (statusValue as InvoiceStatus)
      : undefined,
    competence: competenceValue === null || competenceValue === '' ? undefined : competenceValue,
    contractId: contractIdValue === null || contractIdValue === '' ? undefined : contractIdValue,
  };
  const query = useQuery({
    queryKey: queryKeys.invoices(filters),
    queryFn: () => invoicesApi.list(filters),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const update = (values: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(values).forEach(([key, value]) => {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    if (!Object.hasOwn(values, 'page')) next.set('page', '1');
    setSearchParams(next);
  };

  return (
    <>
      <PageHeader
        title="Faturas"
        description="Consulte as cobranças geradas automaticamente pelo sistema."
      />
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
          <TextField
            label="ID do contrato"
            value={filters.contractId ?? ''}
            onChange={(event) => update({ contractId: event.target.value.trim() })}
            sx={{ flex: 1 }}
          />
          <Button
            variant="text"
            startIcon={<ClearOutlined />}
            onClick={() => setSearchParams({ page: '1', limit: String(filters.limit) })}
          >
            Limpar
          </Button>
        </Stack>
      </Paper>
      {query.isPending ? (
        <LoadingState label="Carregando faturas…" />
      ) : query.isError ? (
        <ProblemAlert error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          title="Nenhuma fatura encontrada"
          description={
            filters.status || filters.competence || filters.contractId
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
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Total
                      </Typography>
                      <Typography>{formatCents(invoice.totalValueCents)}</Typography>
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
                    <TableCell>Contrato</TableCell>
                    <TableCell align="right">Total</TableCell>
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
                      <TableCell sx={{ fontFamily: 'monospace' }}>
                        {invoice.contractId.slice(0, 8)}…
                      </TableCell>
                      <TableCell align="right">{formatCents(invoice.totalValueCents)}</TableCell>
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
