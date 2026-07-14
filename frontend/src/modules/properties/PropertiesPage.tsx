import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import ClearOutlinedIcon from '@mui/icons-material/ClearOutlined';
import HouseOutlinedIcon from '@mui/icons-material/HouseOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
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
import { useEffect, type FormEvent, type ReactNode } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router';
import { UNIT_TYPES, type PropertyListFilters, type UnitType } from '../../api/contract';
import { queryKeys } from '../../api/query-keys';
import { brand } from '../../app/theme/theme';
import { UnitOccupancyChip } from '../../components/data-display/OccupancyChip';
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

const typeIcons: Record<UnitType, ReactNode> = {
  APARTMENT: <ApartmentOutlinedIcon sx={{ fontSize: 20 }} />,
  HOUSE: <HouseOutlinedIcon sx={{ fontSize: 20 }} />,
  COMMERCIAL: <StorefrontOutlinedIcon sx={{ fontSize: 20 }} />,
  KITNET: <BedOutlinedIcon sx={{ fontSize: 20 }} />,
  ROOM: <BedOutlinedIcon sx={{ fontSize: 20 }} />,
};

function TypeIcon({ type }: { type: UnitType }) {
  return (
    <Box
      sx={{
        width: 38,
        height: 38,
        borderRadius: '10px',
        bgcolor: brand.accentTint,
        color: brand.accentDark,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {typeIcons[type]}
    </Box>
  );
}

export function PropertiesPage() {
  const navigate = useNavigate();
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
        description="Unidades imobiliárias disponíveis para locação."
        action={mayCreate ? { label: 'Novo imóvel', to: '/properties/new' } : undefined}
      />
      <Card
        component="form"
        onSubmit={applyFilters}
        key={searchParams.toString()}
        sx={{ mb: 2, p: 2 }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' } }}>
          <TextField
            name="q"
            defaultValue={q ?? ''}
            placeholder="Buscar por bairro ou número da unidade"
            aria-label="Buscar imóvel"
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
          <FormControl sx={{ minWidth: { md: 200 } }}>
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
        <Card sx={{ p: 0 }}>
          {mobile ? (
            <Stack spacing={1.5} sx={{ p: 1.5 }}>
              {rows.map((property) => (
                <Card key={property.id}>
                  <CardContent>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      <TypeIcon type={property.type} />
                      <Box>
                        <Typography sx={{ fontWeight: 700 }}>
                          {property.neighborhood} · Unidade {property.unitNumber}
                        </Typography>
                        <Typography color="text.secondary">{unitTypeLabel(property.type)}</Typography>
                      </Box>
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 1.25 }}>
                      {property.buildingName ?? '—'}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.25 }}>
                      Cadastrado em {formatCivilDate(property.createdAt)}
                    </Typography>
                    <Box sx={{ mt: 1.25 }}>
                      <UnitOccupancyChip occupied={property.occupied} />
                    </Box>
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
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table sx={{ minWidth: 780 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Imóvel</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Prédio</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Cadastrado em</TableCell>
                    <TableCell sx={{ width: 44 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((property) => (
                    <TableRow
                      key={property.id}
                      hover
                      onClick={() => void navigate(`/properties/${property.id}`)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                          <TypeIcon type={property.type} />
                          <Box>
                            <Typography
                              component={RouterLink}
                              to={`/properties/${property.id}`}
                              sx={{
                                display: 'block',
                                fontSize: '0.95rem',
                                fontWeight: 600,
                                color: brand.textPrimary,
                                textDecoration: 'none',
                              }}
                            >
                              {property.neighborhood}
                            </Typography>
                            <Typography sx={{ fontSize: '0.8rem', color: brand.textTertiary }}>
                              Unidade {property.unitNumber}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>{unitTypeLabel(property.type)}</TableCell>
                      <TableCell>{property.buildingName ?? '—'}</TableCell>
                      <TableCell>
                        <UnitOccupancyChip occupied={property.occupied} />
                      </TableCell>
                      <TableCell>{formatCivilDate(property.createdAt)}</TableCell>
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
            <PaginationBar meta={properties.data.meta} onChange={setPagination} />
          </Box>
        </Card>
      )}
    </>
  );
}
