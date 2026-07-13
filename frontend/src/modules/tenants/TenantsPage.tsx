import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import ClearOutlinedIcon from '@mui/icons-material/ClearOutlined';
import {
  Button,
  Card,
  CardActions,
  CardContent,
  FormControl,
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
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, type FormEvent } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router';
import {
  TENANT_CIVIL_STATUSES,
  type TenantCivilStatus,
  type TenantListFilters,
} from '../../api/contract';
import { queryKeys } from '../../api/query-keys';
import { PageHeader } from '../../components/data-display/PageHeader';
import { PaginationBar } from '../../components/data-display/PaginationBar';
import { usePaginationParams } from '../../components/data-display/usePaginationParams';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { EmptyState, LoadingState } from '../../components/feedback/QueryState';
import { hasRole, MANAGEMENT_ROLES } from '../../lib/roles/roles';
import { useAuth } from '../auth/useAuth';
import { tenantsApi } from './api';
import { civilStatusLabel } from './labels';

export function TenantsPage() {
  const { page, limit, setPagination } = usePaginationParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawCivilStatus = searchParams.get('civilStatus');
  const civilStatus = TENANT_CIVIL_STATUSES.includes(rawCivilStatus as TenantCivilStatus)
    ? (rawCivilStatus as TenantCivilStatus)
    : undefined;
  const rawQ = searchParams.get('q')?.trim();
  const q = rawQ === undefined || rawQ === '' ? undefined : rawQ.slice(0, 120);
  const filters: TenantListFilters = { page, limit, q, civilStatus };
  const { session } = useAuth();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const tenants = useQuery({
    queryKey: queryKeys.tenants(filters),
    queryFn: () => tenantsApi.list(filters),
    placeholderData: keepPreviousData,
  });
  const mayCreate = Boolean(session && hasRole(session.user.role, MANAGEMENT_ROLES));
  const rows = tenants.data?.data ?? [];
  const hasFilters = [q, civilStatus].some((value) => value !== undefined);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = new URLSearchParams(searchParams);
    const rawNextQ = data.get('q');
    const rawNextCivilStatus = data.get('civilStatus');
    const nextQ = typeof rawNextQ === 'string' ? rawNextQ.trim().slice(0, 120) : '';
    const nextCivilStatus = typeof rawNextCivilStatus === 'string' ? rawNextCivilStatus : '';
    if (nextQ) next.set('q', nextQ);
    else next.delete('q');
    if (nextCivilStatus) next.set('civilStatus', nextCivilStatus);
    else next.delete('civilStatus');
    next.set('page', '1');
    setSearchParams(next);
  };

  const clearFilters = () => setSearchParams({ page: '1', limit: String(limit) });

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    const normalized = { q, civilStatus };
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
  }, [civilStatus, q, searchParams, setSearchParams]);

  useEffect(() => {
    if (tenants.data && page > Math.max(1, tenants.data.meta.totalPages)) {
      setPagination(1, limit);
    }
  }, [limit, page, setPagination, tenants.data]);

  return (
    <>
      <PageHeader
        title="Locatários"
        description="Consulte os dados cadastrais retornados de forma mascarada."
        action={mayCreate ? { label: 'Novo locatário', to: '/tenants/new' } : undefined}
      />
      <Paper
        component="form"
        variant="outlined"
        onSubmit={applyFilters}
        key={searchParams.toString()}
        sx={{ mb: 2, p: 2 }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            name="q"
            label="Buscar locatário"
            defaultValue={q ?? ''}
            helperText="CPF, e-mail, telefone ou profissão"
            slotProps={{ htmlInput: { maxLength: 120 } }}
            fullWidth
          />
          <FormControl fullWidth sx={{ maxWidth: { md: 260 } }}>
            <InputLabel id="tenant-civil-status-filter">Estado civil</InputLabel>
            <Select
              name="civilStatus"
              labelId="tenant-civil-status-filter"
              label="Estado civil"
              defaultValue={civilStatus ?? ''}
            >
              <MenuItem value="">Todos</MenuItem>
              {TENANT_CIVIL_STATUSES.map((status) => (
                <MenuItem key={status} value={status}>
                  {civilStatusLabel(status)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <Button type="submit">Aplicar</Button>
            <Button
              type="button"
              variant="text"
              startIcon={<ClearOutlinedIcon />}
              onClick={clearFilters}
            >
              Limpar
            </Button>
          </Stack>
        </Stack>
      </Paper>
      {tenants.isPending ? (
        <LoadingState label="Carregando locatários…" />
      ) : tenants.isError ? (
        <ProblemAlert error={tenants.error} onRetry={() => void tenants.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'Nenhum locatário encontrado' : 'Nenhum locatário cadastrado'}
          description={hasFilters ? 'Ajuste ou limpe os filtros para tentar novamente.' : undefined}
        />
      ) : (
        <Paper variant="outlined">
          {mobile ? (
            <Stack spacing={1.5} sx={{ p: 1.5 }}>
              {rows.map((tenant) => (
                <Card variant="outlined" key={tenant.id}>
                  <CardContent>
                    <Typography sx={{ fontWeight: 700 }}>{tenant.cpf}</Typography>
                    <Typography color="text.secondary">{tenant.profession}</Typography>
                    <Typography variant="body2" sx={{ mt: 1, overflowWrap: 'anywhere' }}>
                      {tenant.email}
                    </Typography>
                    <Typography variant="body2">{tenant.mobilePhone}</Typography>
                  </CardContent>
                  <CardActions>
                    <Button
                      component={RouterLink}
                      variant="text"
                      to={`/tenants/${tenant.id}`}
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
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>CPF</TableCell>
                    <TableCell>Profissão</TableCell>
                    <TableCell>Estado civil</TableCell>
                    <TableCell>E-mail</TableCell>
                    <TableCell>Telefone</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((tenant) => (
                    <TableRow hover key={tenant.id}>
                      <TableCell>
                        <Link component={RouterLink} to={`/tenants/${tenant.id}`}>
                          {tenant.cpf}
                        </Link>
                      </TableCell>
                      <TableCell>{tenant.profession}</TableCell>
                      <TableCell>{civilStatusLabel(tenant.civilStatus)}</TableCell>
                      <TableCell sx={{ overflowWrap: 'anywhere' }}>{tenant.email}</TableCell>
                      <TableCell>{tenant.mobilePhone}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <PaginationBar meta={tenants.data.meta} onChange={setPagination} />
        </Paper>
      )}
    </>
  );
}
