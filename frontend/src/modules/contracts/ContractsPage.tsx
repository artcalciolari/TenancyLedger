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
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { EmptyState, LoadingState } from '../../components/feedback/QueryState';
import { formatCivilDate } from '../../lib/dates/dates';
import { formatCents } from '../../lib/money/money';
import { hasRole, MANAGEMENT_ROLES } from '../../lib/roles/roles';
import { useAuth } from '../auth/useAuth';
import { isUuid, parseContractFilters } from './filters';
import { useContracts } from './hooks';
import { contractStatusLabels } from './labels';

function shortId(id: string): string {
  return `${id.slice(0, 8)}…`;
}

interface FiltersFormProps {
  filters: ContractListFilters;
  onApply: (values: { status?: string; tenantId?: string; propertyUnitId?: string }) => void;
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
    });
  };

  return (
    <Paper component="form" variant="outlined" onSubmit={submit} sx={{ mb: 2, p: 2 }}>
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={2}
        sx={{ alignItems: { lg: 'flex-start' } }}
      >
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
        <Stack direction="row" spacing={1}>
          <Button type="submit">Aplicar</Button>
          <Button type="button" variant="text" startIcon={<ClearOutlinedIcon />} onClick={onClear}>
            Limpar
          </Button>
        </Stack>
      </Stack>
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
  const hasFilters = [filters.status, filters.tenantId, filters.propertyUnitId].some(Boolean);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    const normalized: Record<string, string | undefined> = {
      page: searchParams.has('page') ? String(filters.page) : undefined,
      limit: searchParams.has('limit') ? String(filters.limit) : undefined,
      status: filters.status,
      tenantId: filters.tenantId,
      propertyUnitId: filters.propertyUnitId,
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
    filters.page,
    filters.propertyUnitId,
    filters.status,
    filters.tenantId,
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
      />
      <FiltersForm
        key={searchParams.toString()}
        filters={filters}
        onApply={update}
        onClear={() => setSearchParams({ page: '1', limit: String(filters.limit) })}
      />
      {contracts.isPending ? (
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
                      Locatário: {shortId(contract.tenantId)} · Imóvel:{' '}
                      {shortId(contract.propertyUnitId)}
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
                      <TableCell sx={{ fontFamily: 'monospace' }}>
                        {shortId(contract.tenantId)}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>
                        {shortId(contract.propertyUnitId)}
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
