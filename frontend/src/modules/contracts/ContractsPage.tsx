import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  FormHelperText,
  InputAdornment,
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
import { Link as RouterLink, useNavigate } from 'react-router';
import type { ContractListFilters, ContractStatus } from '../../api/contract';
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
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { EmptyState, LoadingState } from '../../components/feedback/QueryState';
import { formatCivilDate } from '../../lib/dates/dates';
import { formatCents } from '../../lib/money/money';
import { hasRole, MANAGEMENT_ROLES } from '../../lib/roles/roles';
import { useAuth } from '../auth/useAuth';
import { contractsApi } from './api';
import { isUuid, parseContractFilters } from './filters';
import { useContracts } from './hooks';

const statusChipOptions: { label: string; value: ContractStatus | undefined }[] = [
  { label: 'Todos', value: undefined },
  { label: 'Ativos', value: 'ACTIVE' },
  { label: 'Expirados', value: 'EXPIRED' },
  { label: 'Encerrados', value: 'TERMINATED' },
];

const contractSearchConfig: ListSearchConfig<ContractListFilters> = {
  filterKeys: [
    'status',
    'tenantId',
    'propertyUnitId',
    'q',
    'moveInFrom',
    'moveInTo',
    'endFrom',
    'endTo',
  ],
  parse: (searchParams, page, limit) => ({
    ...parseContractFilters(searchParams),
    page,
    limit,
  }),
};

interface AdvancedFiltersFormProps {
  filters: ContractListFilters;
  onApply: (values: Record<string, string | undefined>) => void;
}

function formString(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
}

function AdvancedFiltersForm({ filters, onApply }: AdvancedFiltersFormProps) {
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
      tenantId: tenantId || undefined,
      propertyUnitId: propertyUnitId || undefined,
      moveInFrom: formString(data, 'moveInFrom') || undefined,
      moveInTo: formString(data, 'moveInTo') || undefined,
      endFrom: formString(data, 'endFrom') || undefined,
      endTo: formString(data, 'endTo') || undefined,
    });
  };

  return (
    <Box component="form" onSubmit={submit} noValidate>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' },
        }}
      >
        <TextField
          name="tenantId"
          label="ID do locatário"
          defaultValue={filters.tenantId ?? ''}
          error={Boolean(tenantError)}
          helperText={tenantError || 'UUID completo'}
        />
        <TextField
          name="propertyUnitId"
          label="ID do imóvel"
          defaultValue={filters.propertyUnitId ?? ''}
          error={Boolean(propertyError)}
          helperText={propertyError || 'UUID completo'}
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
        <Button type="submit" variant="outlined" sx={{ alignSelf: 'flex-start' }}>
          Aplicar filtros avançados
        </Button>
      </Box>
      {(tenantError || propertyError) && (
        <FormHelperText error sx={{ mt: 1 }}>
          Corrija os identificadores antes de aplicar os filtros.
        </FormHelperText>
      )}
    </Box>
  );
}

export function ContractsPage() {
  const navigate = useNavigate();
  const listParams = useListSearchParams(contractSearchConfig);
  const { filters, hasFilters, searchParamsKey, updateFilters } = listParams;
  const contracts = useContracts(filters);
  const { session } = useAuth();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const mayCreate = Boolean(session && hasRole(session.user.role, MANAGEMENT_ROLES));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState(filters.q ?? '');
  const [lastSyncedQ, setLastSyncedQ] = useState(filters.q ?? '');
  if (lastSyncedQ !== (filters.q ?? '')) {
    setLastSyncedQ(filters.q ?? '');
    setSearchDraft(filters.q ?? '');
  }
  const pageOutOfRange = useListPageRange(listParams, contracts.data?.meta.totalPages, {
    resetTo: 'last',
    preserveLimitParam: true,
  });

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
        title="Contratos"
        description="Consulte vigências e condições das locações."
        action={mayCreate ? { label: 'Novo contrato', to: '/contracts/new' } : undefined}
      >
        <CsvExportButton
          exportCsv={() => contractsApi.exportCsv(filters)}
          filename="contratos.csv"
        />
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
            aria-label="Buscar contrato"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlinedIcon sx={{ color: brand.textTertiary, fontSize: 20 }} />
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
          <Button
            type="button"
            variant="outlined"
            startIcon={<TuneOutlinedIcon />}
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
            <AdvancedFiltersForm
              key={searchParamsKey}
              filters={filters}
              onApply={(values) => updateFilters(values)}
            />
          </Box>
        )}
      </Card>
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
        <Card sx={{ p: 0 }}>
          {mobile ? (
            <Stack spacing={1.5} sx={{ p: 1.5 }}>
              {contracts.data.data.map((contract) => (
                <Card key={contract.id}>
                  <CardContent>
                    <Stack
                      direction="row"
                      sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <Typography sx={{ fontWeight: 700, color: brand.textPrimary }}>
                        {contract.propertyUnit.neighborhood} · Unid.{' '}
                        {contract.propertyUnit.unitNumber}
                      </Typography>
                      <StatusChip status={contract.status} />
                    </Stack>
                    <Typography sx={{ fontSize: '0.8rem', color: brand.textTertiary, mt: 0.25 }}>
                      {contract.tenant.name} · CPF {contract.tenant.cpf}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1.25 }}>
                      {formatCivilDate(contract.moveInDate)} a {formatCivilDate(contract.endDate)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatCents(contract.monthlyBaseValueCents)} por mês
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
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table sx={{ minWidth: 700 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Contrato</TableCell>
                    <TableCell>Vigência</TableCell>
                    <TableCell align="right">Aluguel mensal</TableCell>
                    <TableCell>Situação</TableCell>
                    <TableCell sx={{ width: 44 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {contracts.data.data.map((contract) => (
                    <TableRow
                      hover
                      key={contract.id}
                      onClick={() => void navigate(`/contracts/${contract.id}`)}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: brand.surfaceSubtle } }}
                    >
                      <TableCell>
                        <Typography
                          component={RouterLink}
                          to={`/contracts/${contract.id}`}
                          sx={{
                            display: 'block',
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            color: brand.textPrimary,
                            textDecoration: 'none',
                          }}
                        >
                          {contract.propertyUnit.neighborhood} · Unid.{' '}
                          {contract.propertyUnit.unitNumber}
                        </Typography>
                        <Typography
                          sx={{ fontSize: '0.8rem', color: brand.textTertiary, mt: 0.25 }}
                        >
                          {contract.tenant.name} · CPF {contract.tenant.cpf}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {formatCivilDate(contract.moveInDate)} – {formatCivilDate(contract.endDate)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatCents(contract.monthlyBaseValueCents)}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={contract.status} />
                      </TableCell>
                      <TableCell align="right" sx={{ color: brand.borderInput }}>
                        <ChevronRightOutlinedIcon />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <Box sx={{ bgcolor: brand.surfaceSubtle, borderTop: `1px solid ${brand.borderCard}` }}>
            <PaginationBar
              meta={contracts.data.meta}
              onChange={(page, limit) => updateFilters({ page, limit })}
            />
          </Box>
        </Card>
      )}
      {contracts.isFetching && !contracts.isPending && (
        <Box role="status" aria-live="polite" sx={{ mt: 1 }}>
          Atualizando…
        </Box>
      )}
    </>
  );
}
