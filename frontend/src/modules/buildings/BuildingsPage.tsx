import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
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
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FormEvent } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import type { BuildingListFilters } from '../../api/contract';
import { queryKeys } from '../../api/query-keys';
import { brand } from '../../app/theme/theme';
import { BuildingOccupancyChip } from '../../components/data-display/OccupancyChip';
import { PageHeader } from '../../components/data-display/PageHeader';
import { PaginationBar } from '../../components/data-display/PaginationBar';
import {
  type ListSearchConfig,
  useListPageRange,
  useListSearchParams,
} from '../../components/data-display/useListSearchParams';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { EmptyState, LoadingState } from '../../components/feedback/QueryState';
import { hasRole, MANAGEMENT_ROLES } from '../../lib/roles/roles';
import { useAuth } from '../auth/useAuth';
import { buildingsApi } from './api';

const buildingSearchConfig: ListSearchConfig<BuildingListFilters> = {
  filterKeys: ['q'],
  parse: (searchParams, page, limit) => {
    const rawQ = searchParams.get('q')?.trim();
    const q = rawQ === undefined || rawQ === '' ? undefined : rawQ.slice(0, 120);
    return { page, limit, q };
  },
};

function BuildingIcon() {
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
      <ApartmentOutlinedIcon sx={{ fontSize: 20 }} />
    </Box>
  );
}

export function BuildingsPage() {
  const navigate = useNavigate();
  const listParams = useListSearchParams(buildingSearchConfig);
  const { applyFilters, clearFilters, filters, hasFilters, searchParamsKey, setPagination } =
    listParams;
  const { q } = filters;
  const { session } = useAuth();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const buildings = useQuery({
    queryKey: queryKeys.buildings(filters),
    queryFn: () => buildingsApi.list(filters),
    placeholderData: keepPreviousData,
  });
  const mayCreate = Boolean(session && hasRole(session.user.role, MANAGEMENT_ROLES));
  const rows = buildings.data?.data ?? [];
  useListPageRange(listParams, buildings.data?.meta.totalPages);

  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applyFilters(new FormData(event.currentTarget));
  };

  return (
    <>
      <PageHeader
        title="Prédios"
        description="Edifícios com suas unidades e taxa de ocupação."
        action={mayCreate ? { label: 'Novo prédio', to: '/buildings/new' } : undefined}
      />
      <Card component="form" onSubmit={submitFilters} key={searchParamsKey} sx={{ mb: 2, p: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          sx={{ alignItems: { md: 'center' } }}
        >
          <TextField
            name="q"
            defaultValue={q ?? ''}
            placeholder="Buscar por nome, bairro ou endereço"
            aria-label="Buscar prédio"
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
      {buildings.isPending ? (
        <LoadingState label="Carregando prédios…" />
      ) : buildings.isError ? (
        <ProblemAlert error={buildings.error} onRetry={() => void buildings.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'Nenhum prédio encontrado' : 'Nenhum prédio cadastrado'}
          description={hasFilters ? 'Ajuste ou limpe os filtros para tentar novamente.' : undefined}
        />
      ) : (
        <Card sx={{ p: 0 }}>
          {mobile ? (
            <Stack spacing={1.5} sx={{ p: 1.5 }}>
              {rows.map((building) => (
                <Card key={building.id}>
                  <CardContent>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      <BuildingIcon />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700 }}>{building.name}</Typography>
                        <Typography color="text.secondary">{building.neighborhood}</Typography>
                      </Box>
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 1.25 }}>
                      {building.address ?? '—'}
                    </Typography>
                    <Box sx={{ mt: 1.25 }}>
                      <BuildingOccupancyChip
                        occupiedUnits={building.occupiedUnits}
                        totalUnits={building.totalUnits}
                      />
                    </Box>
                  </CardContent>
                  <CardActions>
                    <Button
                      component={RouterLink}
                      variant="text"
                      to={`/buildings/${building.id}`}
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
                    <TableCell>Prédio</TableCell>
                    <TableCell>Endereço</TableCell>
                    <TableCell>Ocupação</TableCell>
                    <TableCell sx={{ width: 44 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((building) => (
                    <TableRow
                      key={building.id}
                      hover
                      onClick={() => void navigate(`/buildings/${building.id}`)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                          <BuildingIcon />
                          <Box>
                            <Typography
                              component={RouterLink}
                              to={`/buildings/${building.id}`}
                              sx={{
                                display: 'block',
                                fontSize: '0.95rem',
                                fontWeight: 600,
                                color: brand.textPrimary,
                                textDecoration: 'none',
                              }}
                            >
                              {building.name}
                            </Typography>
                            <Typography sx={{ fontSize: '0.8rem', color: brand.textTertiary }}>
                              {building.neighborhood}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>{building.address ?? '—'}</TableCell>
                      <TableCell>
                        <BuildingOccupancyChip
                          occupiedUnits={building.occupiedUnits}
                          totalUnits={building.totalUnits}
                        />
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
            <PaginationBar meta={buildings.data.meta} onChange={setPagination} />
          </Box>
        </Card>
      )}
    </>
  );
}
