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
import { UNIT_TYPES, type PropertyListFilters, type UnitType } from '../../api/contract';
import { queryKeys } from '../../api/query-keys';
import { PageHeader } from '../../components/data-display/PageHeader';
import { PaginationBar } from '../../components/data-display/PaginationBar';
import { usePaginationParams } from '../../components/data-display/usePaginationParams';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { EmptyState, LoadingState } from '../../components/feedback/QueryState';
import { formatCivilDate } from '../../lib/dates/dates';
import { hasRole, MANAGEMENT_ROLES } from '../../lib/roles/roles';
import { useAuth } from '../auth/useAuth';
import { propertiesApi } from './api';
import { unitTypeLabel } from './labels';

export function PropertiesPage() {
  const { page, limit, setPagination } = usePaginationParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawType = searchParams.get('type');
  const type = UNIT_TYPES.includes(rawType as UnitType) ? (rawType as UnitType) : undefined;
  const rawQ = searchParams.get('q')?.trim();
  const q = rawQ === undefined || rawQ === '' ? undefined : rawQ.slice(0, 120);
  const filters: PropertyListFilters = { page, limit, q, type };
  const { session } = useAuth();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const properties = useQuery({
    queryKey: queryKeys.properties(filters),
    queryFn: () => propertiesApi.list(filters),
    placeholderData: keepPreviousData,
  });
  const mayCreate = Boolean(session && hasRole(session.user.role, MANAGEMENT_ROLES));
  const rows = properties.data?.data ?? [];
  const hasFilters = [q, type].some((value) => value !== undefined);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = new URLSearchParams(searchParams);
    const rawNextQ = data.get('q');
    const rawNextType = data.get('type');
    const nextQ = typeof rawNextQ === 'string' ? rawNextQ.trim().slice(0, 120) : '';
    const nextType = typeof rawNextType === 'string' ? rawNextType : '';
    if (nextQ) next.set('q', nextQ);
    else next.delete('q');
    if (nextType) next.set('type', nextType);
    else next.delete('type');
    next.set('page', '1');
    setSearchParams(next);
  };

  const clearFilters = () => setSearchParams({ page: '1', limit: String(limit) });

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    const normalized = { q, type };
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
  }, [q, searchParams, setSearchParams, type]);

  useEffect(() => {
    if (properties.data && page > Math.max(1, properties.data.meta.totalPages)) {
      setPagination(1, limit);
    }
  }, [limit, page, properties.data, setPagination]);

  return (
    <>
      <PageHeader
        title="Imóveis"
        description="Consulte as unidades imobiliárias cadastradas."
        action={mayCreate ? { label: 'Novo imóvel', to: '/properties/new' } : undefined}
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
            label="Buscar imóvel"
            defaultValue={q ?? ''}
            helperText="Bairro ou número da unidade"
            slotProps={{ htmlInput: { maxLength: 120 } }}
            fullWidth
          />
          <FormControl fullWidth sx={{ maxWidth: { md: 260 } }}>
            <InputLabel id="property-type-filter">Tipo</InputLabel>
            <Select
              name="type"
              labelId="property-type-filter"
              label="Tipo"
              defaultValue={type ?? ''}
            >
              <MenuItem value="">Todos</MenuItem>
              {UNIT_TYPES.map((unitType) => (
                <MenuItem key={unitType} value={unitType}>
                  {unitTypeLabel(unitType)}
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
      {properties.isPending ? (
        <LoadingState label="Carregando imóveis…" />
      ) : properties.isError ? (
        <ProblemAlert error={properties.error} onRetry={() => void properties.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'Nenhum imóvel encontrado' : 'Nenhum imóvel cadastrado'}
          description={hasFilters ? 'Ajuste ou limpe os filtros para tentar novamente.' : undefined}
        />
      ) : (
        <Paper variant="outlined">
          {mobile ? (
            <Stack spacing={1.5} sx={{ p: 1.5 }}>
              {rows.map((property) => (
                <Card variant="outlined" key={property.id}>
                  <CardContent>
                    <Typography sx={{ fontWeight: 700 }}>
                      {property.neighborhood} · {property.unitNumber}
                    </Typography>
                    <Typography color="text.secondary">{unitTypeLabel(property.type)}</Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Cadastrado em {formatCivilDate(property.createdAt)}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button
                      component={RouterLink}
                      variant="text"
                      to={`/properties/${property.id}`}
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
                    <TableCell>Bairro</TableCell>
                    <TableCell>Unidade</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Cadastro</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((property) => (
                    <TableRow key={property.id} hover>
                      <TableCell>
                        <Link component={RouterLink} to={`/properties/${property.id}`}>
                          {property.neighborhood}
                        </Link>
                      </TableCell>
                      <TableCell>{property.unitNumber}</TableCell>
                      <TableCell>{unitTypeLabel(property.type)}</TableCell>
                      <TableCell>{formatCivilDate(property.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <PaginationBar meta={properties.data.meta} onChange={setPagination} />
        </Paper>
      )}
    </>
  );
}
