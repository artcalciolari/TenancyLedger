import ClearOutlinedIcon from '@mui/icons-material/ClearOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  FormControl,
  FormHelperText,
  InputLabel,
  Link,
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
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useState, type FormEvent } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { CONTRACT_STATUSES, type ContractListFilters } from '../../api/contract';
import { PageHeader } from '../../components/data-display/PageHeader';
import { PaginationBar } from '../../components/data-display/PaginationBar';
import { StatusChip } from '../../components/data-display/StatusChip';
import { CsvExportButton } from '../../components/data-display/CsvExportButton';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { EmptyState, LoadingState } from '../../components/feedback/QueryState';
import { formatCivilDate } from '../../lib/dates/dates';
import { formatCents } from '../../lib/money/money';
import { clampPage } from '../../lib/pagination/pagination';
import { hasRole, MANAGEMENT_ROLES } from '../../lib/roles/roles';
import { useAuth } from '../auth/useAuth';
import { contractsApi } from './api';
import { isUuid, parseContractFilters } from './filters';
import { useContracts } from './hooks';
import { contractStatusLabels } from './labels';

function shortId(id: string): string {
  return `${id.slice(0, 8)}…`;
}

interface FiltersFormProps {
  filters: ContractListFilters;
  onApply: (values: Record<string, string | undefined>) => void;
  onClear: () => void;
}

function formString(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
}

function FiltersForm({ filters, onApply, onClear }: FiltersFormProps) {
  const [tenantError, setTenantError] = useState('');
  const [propertyError, setPropertyError] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const tenantId = formString(data, 'tenantId').trim();
    const propertyUnitId = formString(data, 'propertyUnitId').trim();
    const tenantIsValid = !tenantId || isUuid(tenantId);
    const propertyIsValid = !propertyUnitId || isUuid(propertyUnitId);
    setTenantError(tenantIsValid ? '' : 'Informe um UUID v4 válido.');
    setPropertyError(propertyIsValid ? '' : 'Informe um UUID v4 válido.');
    if (!tenantIsValid || !propertyIsValid) return;
    onApply({
      status: formString(data, 'status') || undefined,
      tenantId: tenantId || undefined,
      propertyUnitId: propertyUnitId || undefined,
      q: formString(data, 'q').trim() || undefined,
      moveInFrom: formString(data, 'moveInFrom') || undefined,
      moveInTo: formString(data, 'moveInTo') || undefined,
      endFrom: formString(data, 'endFrom') || undefined,
      endTo: formString(data, 'endTo') || undefined,
    });
  };

  return (
    <Paper component="form" variant="outlined" onSubmit={submit} sx={{ mb: 2, p: 2 }}>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' },
        }}
      >
        <TextField
          name="q"
          label="Buscar contrato"
          defaultValue={filters.q ?? ''}
          helperText="CPF, profissão, bairro ou unidade"
        />
        <FormControl size="small" fullWidth sx={{ maxWidth: { lg: 220 } }}>
          <InputLabel id="contract-status-filter-label">Status</InputLabel>
          <Select
            labelId="contract-status-filter-label"
            name="status"
            label="Status"
            defaultValue={filters.status ?? ''}
          >
            <MenuItem value="">Todos</MenuItem>
            {CONTRACT_STATUSES.map((status) => (
              <MenuItem value={status} key={status}>
                {contractStatusLabels[status]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          name="tenantId"
          label="ID do locatário"
          defaultValue={filters.tenantId ?? ''}
          error={Boolean(tenantError)}
          helperText={tenantError || 'UUID completo'}
          sx={{ flex: 1 }}
        />
        <TextField
          name="propertyUnitId"
          label="ID do imóvel"
          defaultValue={filters.propertyUnitId ?? ''}
          error={Boolean(propertyError)}
          helperText={propertyError || 'UUID completo'}
          sx={{ flex: 1 }}
        />
        <TextField
          name="moveInFrom"
          label="Entrada a partir de"
          type="date"
          defaultValue={filters.moveInFrom ?? ''}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          name="moveInTo"
          label="Entrada até"
          type="date"
          defaultValue={filters.moveInTo ?? ''}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          name="endFrom"
          label="Término a partir de"
          type="date"
          defaultValue={filters.endFrom ?? ''}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          name="endTo"
          label="Término até"
          type="date"
          defaultValue={filters.endTo ?? ''}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Stack direction="row" spacing={1}>
          <Button type="submit">Aplicar</Button>
          <Button type="button" variant="text" startIcon={<ClearOutlinedIcon />} onClick={onClear}>
            Limpar
          </Button>
        </Stack>
      </Box>
      {(tenantError || propertyError) && (
        <FormHelperText error>
          Corrija os identificadores antes de aplicar os filtros.
        </FormHelperText>
      )}
    </Paper>
  );
}

export function ContractsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseContractFilters(searchParams);
  const contracts = useContracts(filters);
  const { session } = useAuth();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const mayCreate = Boolean(session && hasRole(session.user.role, MANAGEMENT_ROLES));
  const hasFilters = [
    filters.status,
    filters.tenantId,
    filters.propertyUnitId,
    filters.q,
    filters.moveInFrom,
    filters.moveInTo,
    filters.endFrom,
    filters.endTo,
  ].some(Boolean);
  const normalizedPage = contracts.data
    ? clampPage(filters.page, contracts.data.meta.totalPages)
    : filters.page;
  const pageOutOfRange = normalizedPage !== filters.page;

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    const normalized: Record<string, string | undefined> = {
      page: searchParams.has('page') || pageOutOfRange ? String(normalizedPage) : undefined,
      limit: searchParams.has('limit') ? String(filters.limit) : undefined,
      status: filters.status,
      tenantId: filters.tenantId,
      propertyUnitId: filters.propertyUnitId,
      q: filters.q,
      moveInFrom: filters.moveInFrom,
      moveInTo: filters.moveInTo,
      endFrom: filters.endFrom,
      endTo: filters.endTo,
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
    filters.limit,
    filters.moveInFrom,
    filters.moveInTo,
    filters.endFrom,
    filters.endTo,
    filters.page,
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

  return (
    <>
      <PageHeader
        title="Contratos"
        description="Consulte vigências e condições das locações."
        action={mayCreate ? { label: 'Novo contrato', to: '/contracts/new' } : undefined}
      >
        <CsvExportButton
          exportCsv={() => contractsApi.exportCsv(filters)}
          filename="contratos.csv"
        />
      </PageHeader>
      <FiltersForm
        key={searchParams.toString()}
        filters={filters}
        onApply={update}
        onClear={() => setSearchParams({ page: '1', limit: String(filters.limit) })}
      />
      {contracts.isPending || pageOutOfRange ? (
        <LoadingState label="Carregando contratos…" />
      ) : contracts.isError ? (
        <ProblemAlert error={contracts.error} onRetry={() => void contracts.refetch()} />
      ) : contracts.data.data.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'Nenhum contrato encontrado' : 'Nenhum contrato cadastrado'}
          description={hasFilters ? 'Ajuste ou limpe os filtros para tentar novamente.' : undefined}
        />
      ) : (
        <Paper variant="outlined">
          {mobile ? (
            <Stack spacing={1.5} sx={{ p: 1.5 }}>
              {contracts.data.data.map((contract) => (
                <Card variant="outlined" key={contract.id}>
                  <CardContent>
                    <Stack
                      direction="row"
                      sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <Typography sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        {shortId(contract.id)}
                      </Typography>
                      <StatusChip status={contract.status} />
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {formatCivilDate(contract.moveInDate)} a {formatCivilDate(contract.endDate)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatCents(contract.monthlyBaseValueCents)} por mês
                    </Typography>
                    <Typography
                      variant="caption"
                      component="div"
                      sx={{ mt: 1, overflowWrap: 'anywhere' }}
                    >
                      Locatário: {contract.tenant.cpf} · {contract.tenant.profession}
                      <br />
                      Imóvel: {contract.propertyUnit.neighborhood} · unidade{' '}
                      {contract.propertyUnit.unitNumber}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button
                      component={RouterLink}
                      to={`/contracts/${contract.id}`}
                      variant="text"
                      startIcon={<OpenInNewOutlinedIcon />}
                    >
                      Ver detalhes
                    </Button>
                  </CardActions>
                </Card>
              ))}
            </Stack>
          ) : (
            <TableContainer>
              <Table sx={{ minWidth: 900 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Contrato</TableCell>
                    <TableCell>Locatário</TableCell>
                    <TableCell>Imóvel</TableCell>
                    <TableCell>Vigência</TableCell>
                    <TableCell align="right">Aluguel mensal</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {contracts.data.data.map((contract) => (
                    <TableRow hover key={contract.id}>
                      <TableCell>
                        <Link
                          component={RouterLink}
                          to={`/contracts/${contract.id}`}
                          sx={{ fontFamily: 'monospace' }}
                        >
                          {shortId(contract.id)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{contract.tenant.cpf}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {contract.tenant.profession}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {contract.propertyUnit.neighborhood}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Unidade {contract.propertyUnit.unitNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {formatCivilDate(contract.moveInDate)} – {formatCivilDate(contract.endDate)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCents(contract.monthlyBaseValueCents)}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={contract.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <PaginationBar
            meta={contracts.data.meta}
            onChange={(page, limit) => update({ page, limit })}
          />
        </Paper>
      )}
      {contracts.isFetching && !contracts.isPending && (
        <Box role="status" aria-live="polite" sx={{ mt: 1 }}>
          Atualizando…
        </Box>
      )}
    </>
  );
}
