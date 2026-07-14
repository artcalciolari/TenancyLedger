import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import ClearOutlinedIcon from '@mui/icons-material/ClearOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
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
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, type FormEvent } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router';
import {
  TENANT_CIVIL_STATUSES,
  type TenantCivilStatus,
  type TenantListFilters,
} from '../../api/contract';
import { queryKeys } from '../../api/query-keys';
import { brand } from '../../app/theme/theme';
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
  const navigate = useNavigate();
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
        description="Dados cadastrais dos locatários vinculados aos contratos."
        action={mayCreate ? { label: 'Novo locatário', to: '/tenants/new' } : undefined}
      />
      <Card
        component="form"
        onSubmit={applyFilters}
        key={searchParams.toString()}
        sx={{ mb: 2, p: 2 }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          sx={{ alignItems: { md: 'center' } }}
        >
          <TextField
            name="q"
            defaultValue={q ?? ''}
            placeholder="Buscar por CPF, e-mail, telefone ou profissão"
            aria-label="Buscar locatário"
            slotProps={{
              htmlInput: { maxLength: 120 },
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
          <FormControl sx={{ minWidth: { md: 220 } }}>
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
          <Stack direction="row" spacing={1}>
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
      </Card>
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
        <Card sx={{ p: 0 }}>
          {mobile ? (
            <Stack spacing={1.5} sx={{ p: 1.5 }}>
              {rows.map((tenant) => (
                <Card key={tenant.id}>
                  <CardContent>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 38,
                          height: 38,
                          borderRadius: '50%',
                          bgcolor: brand.accentTint,
                          color: brand.accentDark,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          flexShrink: 0,
                        }}
                      >
                        {tenant.name.charAt(0).toUpperCase()}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700 }}>{tenant.name}</Typography>
                        <Typography sx={{ fontSize: '0.8rem', color: brand.textTertiary }}>
                          {tenant.profession} · CPF {tenant.cpf}
                        </Typography>
                      </Box>
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 1.25 }}>
                      {civilStatusLabel(tenant.civilStatus)}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {tenant.email}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {tenant.mobilePhone}
                    </Typography>
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
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table sx={{ minWidth: 680 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Locatário</TableCell>
                    <TableCell>Estado civil</TableCell>
                    <TableCell>Contato</TableCell>
                    <TableCell sx={{ width: 44 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((tenant) => (
                    <TableRow
                      hover
                      key={tenant.id}
                      onClick={() => void navigate(`/tenants/${tenant.id}`)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                          <Box
                            sx={{
                              width: 38,
                              height: 38,
                              borderRadius: '50%',
                              bgcolor: brand.accentTint,
                              color: brand.accentDark,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.9rem',
                              flexShrink: 0,
                            }}
                          >
                            {tenant.name.charAt(0).toUpperCase()}
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              component={RouterLink}
                              to={`/tenants/${tenant.id}`}
                              sx={{
                                display: 'block',
                                fontSize: '0.95rem',
                                fontWeight: 600,
                                color: brand.textPrimary,
                                textDecoration: 'none',
                              }}
                            >
                              {tenant.name}
                            </Typography>
                            <Typography sx={{ fontSize: '0.8rem', color: brand.textTertiary }}>
                              {tenant.profession} · CPF {tenant.cpf}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>{civilStatusLabel(tenant.civilStatus)}</TableCell>
                      <TableCell
                        sx={{
                          overflowWrap: 'anywhere',
                          fontSize: '0.86rem',
                          color: brand.textSecondary,
                        }}
                      >
                        {tenant.email} · {tenant.mobilePhone}
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
            <PaginationBar meta={tenants.data.meta} onChange={setPagination} />
          </Box>
        </Card>
      )}
    </>
  );
}
