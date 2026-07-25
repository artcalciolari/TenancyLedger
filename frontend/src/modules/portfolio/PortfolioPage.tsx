import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
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
  MenuItem,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type FormEvent, useMemo } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import type { BuildingVacancyFilter, RoomAvailabilityStatus } from '../../api/contract';
import { queryKeys } from '../../api/query-keys';
import { brand } from '../../app/theme/theme';
import {
  BuildingOccupancyChip,
  UnitOccupancyChip,
} from '../../components/data-display/OccupancyChip';
import { PageHeader } from '../../components/data-display/PageHeader';
import { PaginationBar } from '../../components/data-display/PaginationBar';
import { useListPageRange } from '../../components/data-display/useListSearchParams';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { EmptyState, LoadingState } from '../../components/feedback/QueryState';
import { localDateIso } from '../../lib/dates/dates';
import { hasRole, MANAGEMENT_ROLES } from '../../lib/roles/roles';
import { useAuth } from '../auth/useAuth';
import { buildingsApi } from '../buildings/api';
import { roomsApi } from '../rooms/api';
import {
  type PortfolioTab,
  usePortfolioBuildingsSearchParams,
  usePortfolioRoomsSearchParams,
  usePortfolioTab,
} from './search-params';

type BuildingVacancyOption = '' | BuildingVacancyFilter;
type RoomStatusOption = '' | RoomAvailabilityStatus;
type BuildingRow = Awaited<ReturnType<typeof buildingsApi.list>>['data'][number];
type RoomRow = Awaited<ReturnType<typeof roomsApi.list>>['data'][number];

const buildingVacancyOptions: readonly { value: BuildingVacancyOption; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'WITH_VACANCY', label: 'Com vagas' },
  { value: 'FULL', label: 'Lotado' },
  { value: 'NO_ROOMS', label: 'Sem quartos' },
];

const roomStatusOptions: readonly { value: RoomStatusOption; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'VACANT', label: 'Vago' },
  { value: 'OCCUPIED', label: 'Ocupado' },
];

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

function RoomIcon() {
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
      <BedOutlinedIcon sx={{ fontSize: 20 }} />
    </Box>
  );
}

function vacancyPercentageLabel(
  building: Pick<BuildingRow, 'totalRooms' | 'vacancyPercentage'>,
): string {
  if (building.totalRooms === 0 || building.vacancyPercentage === null) return 'Sem quartos';
  return `${building.vacancyPercentage.toFixed(1).replace('.0', '')}% de vacância`;
}

function roomLocationLabel(
  room: Pick<RoomRow, 'buildingNeighborhood' | 'buildingAddress'>,
): string {
  return room.buildingAddress
    ? `${room.buildingNeighborhood} · ${room.buildingAddress}`
    : room.buildingNeighborhood;
}

function tabAction(tab: PortfolioTab) {
  return tab === 'rooms'
    ? { label: 'Novo quarto', to: '/rooms/new' }
    : { label: 'Novo prédio', to: '/buildings/new' };
}

function BuildingsTab({ defaultDate }: { defaultDate: string }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const listParams = usePortfolioBuildingsSearchParams(defaultDate);
  const { applyFilters, clearFilters, filters, hasFilters, setPagination } = listParams;
  const formKey = [filters.q ?? '', filters.date ?? defaultDate, filters.vacancy ?? ''].join('|');
  const buildings = useQuery({
    queryKey: queryKeys.buildings(filters),
    queryFn: () => buildingsApi.list(filters),
    placeholderData: keepPreviousData,
  });
  const rows = buildings.data?.data ?? [];
  useListPageRange(listParams, buildings.data?.meta.totalPages);

  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applyFilters(new FormData(event.currentTarget));
  };

  return (
    <>
      <Card component="form" onSubmit={submitFilters} key={formKey} sx={{ mb: 2, p: 2 }}>
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            sx={{ alignItems: { md: 'center' } }}
          >
            <TextField
              name="q"
              defaultValue={filters.q ?? ''}
              placeholder="Buscar por nome, bairro ou endereço"
              slotProps={{
                htmlInput: { maxLength: 120, 'aria-label': 'Buscar prédio' },
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
            <TextField
              name="date"
              label="Data de referência"
              type="date"
              defaultValue={filters.date ?? defaultDate}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ minWidth: { xs: '100%', md: 220 } }}
            />
            <TextField
              name="vacancy"
              label="Vacância"
              select
              defaultValue={filters.vacancy ?? ''}
              sx={{ minWidth: { xs: '100%', md: 220 } }}
            >
              {buildingVacancyOptions.map((option) => (
                <MenuItem key={option.label} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
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
                        occupiedRooms={building.occupiedRooms}
                        totalRooms={building.totalRooms}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ mt: 1, color: brand.textSecondary }}>
                      {vacancyPercentageLabel(building)} · {building.vacantRooms} vagos ·{' '}
                      {building.occupiedRooms} ocupados · {building.totalRooms} quartos
                    </Typography>
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
              <Table sx={{ minWidth: 840 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Prédio</TableCell>
                    <TableCell>Localização</TableCell>
                    <TableCell>Ocupação</TableCell>
                    <TableCell>Vacância</TableCell>
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
                        <Stack spacing={0.6}>
                          <BuildingOccupancyChip
                            occupiedRooms={building.occupiedRooms}
                            totalRooms={building.totalRooms}
                          />
                          <Typography sx={{ fontSize: '0.8rem', color: brand.textSecondary }}>
                            {building.vacantRooms} vagos · {building.occupiedRooms} ocupados ·{' '}
                            {building.totalRooms} quartos
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{vacancyPercentageLabel(building)}</TableCell>
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

function RoomsTab({ defaultDate }: { defaultDate: string }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const listParams = usePortfolioRoomsSearchParams(defaultDate);
  const { applyFilters, clearFilters, filters, hasFilters, setPagination } = listParams;
  const formKey = [
    filters.q ?? '',
    filters.buildingId ?? '',
    filters.status ?? '',
    filters.date ?? defaultDate,
  ].join('|');
  const rooms = useQuery({
    queryKey: queryKeys.rooms(filters),
    queryFn: () => roomsApi.list(filters),
    placeholderData: keepPreviousData,
  });
  const buildingOptions = useQuery({
    queryKey: queryKeys.buildings({ page: 1, limit: 100, date: filters.date }),
    queryFn: () => buildingsApi.list({ page: 1, limit: 100, date: filters.date }),
    placeholderData: keepPreviousData,
  });
  const rows = rooms.data?.data ?? [];
  useListPageRange(listParams, rooms.data?.meta.totalPages);

  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applyFilters(new FormData(event.currentTarget));
  };

  return (
    <>
      <Card component="form" onSubmit={submitFilters} key={formKey} sx={{ mb: 2, p: 2 }}>
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            sx={{ alignItems: { md: 'center' } }}
          >
            <TextField
              name="q"
              defaultValue={filters.q ?? ''}
              placeholder="Buscar por número, prédio, bairro ou endereço"
              slotProps={{
                htmlInput: { maxLength: 120, 'aria-label': 'Buscar quarto' },
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
            <TextField
              name="buildingId"
              label="Prédio"
              select
              defaultValue={filters.buildingId ?? ''}
              sx={{ minWidth: { xs: '100%', md: 240 } }}
            >
              <MenuItem value="">Todos</MenuItem>
              {(buildingOptions.data?.data ?? []).map((building) => (
                <MenuItem key={building.id} value={building.id}>
                  {building.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              name="status"
              label="Situação"
              select
              defaultValue={filters.status ?? ''}
              sx={{ minWidth: { xs: '100%', md: 180 } }}
            >
              {roomStatusOptions.map((option) => (
                <MenuItem key={option.label} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              name="date"
              label="Data de referência"
              type="date"
              defaultValue={filters.date ?? defaultDate}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ minWidth: { xs: '100%', md: 220 } }}
            />
          </Stack>
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
      {rooms.isPending ? (
        <LoadingState label="Carregando quartos…" />
      ) : rooms.isError ? (
        <ProblemAlert error={rooms.error} onRetry={() => void rooms.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'Nenhum quarto encontrado' : 'Nenhum quarto cadastrado'}
          description={hasFilters ? 'Ajuste ou limpe os filtros para tentar novamente.' : undefined}
        />
      ) : (
        <Card sx={{ p: 0 }}>
          {mobile ? (
            <Stack spacing={1.5} sx={{ p: 1.5 }}>
              {rows.map((room) => (
                <Card key={room.id}>
                  <CardContent>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      <RoomIcon />
                      <Box>
                        <Typography sx={{ fontWeight: 700 }}>Quarto {room.number}</Typography>
                        <Typography color="text.secondary">{room.buildingName}</Typography>
                      </Box>
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 1.25 }}>
                      {roomLocationLabel(room)}
                    </Typography>
                    <Box sx={{ mt: 1.25 }}>
                      <UnitOccupancyChip occupied={room.occupied} />
                    </Box>
                  </CardContent>
                  <CardActions>
                    <Button
                      component={RouterLink}
                      variant="text"
                      to={`/rooms/${room.id}`}
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
              <Table sx={{ minWidth: 840 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Quarto</TableCell>
                    <TableCell>Prédio</TableCell>
                    <TableCell>Localização</TableCell>
                    <TableCell>Situação</TableCell>
                    <TableCell sx={{ width: 44 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((room) => (
                    <TableRow
                      key={room.id}
                      hover
                      onClick={() => void navigate(`/rooms/${room.id}`)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                          <RoomIcon />
                          <Typography
                            component={RouterLink}
                            to={`/rooms/${room.id}`}
                            sx={{
                              display: 'block',
                              fontSize: '0.95rem',
                              fontWeight: 600,
                              color: brand.textPrimary,
                              textDecoration: 'none',
                            }}
                          >
                            Quarto {room.number}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{room.buildingName}</TableCell>
                      <TableCell>{roomLocationLabel(room)}</TableCell>
                      <TableCell>
                        <UnitOccupancyChip occupied={room.occupied} />
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
            <PaginationBar meta={rooms.data.meta} onChange={setPagination} />
          </Box>
        </Card>
      )}
    </>
  );
}

export function PortfolioPage() {
  const { session } = useAuth();
  const { tab, setTab } = usePortfolioTab();
  const defaultDate = useMemo(() => localDateIso(), []);
  const mayCreate = Boolean(session && hasRole(session.user.role, MANAGEMENT_ROLES));

  return (
    <>
      <PageHeader
        title="Prédios e quartos"
        description="Gestão unificada do portfólio com ocupação por data de referência."
        action={mayCreate ? tabAction(tab) : undefined}
      />
      <Card sx={{ mb: 2, p: { xs: 1, sm: 1.5 } }}>
        <Tabs
          value={tab}
          onChange={(_, nextTab: PortfolioTab) => setTab(nextTab)}
          aria-label="Abas de portfólio"
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{
            minHeight: 0,
            '& .MuiTab-root': { minHeight: 44, fontWeight: 600 },
          }}
        >
          <Tab label="Prédios" value="buildings" />
          <Tab label="Quartos" value="rooms" />
        </Tabs>
      </Card>
      {tab === 'rooms' ? (
        <RoomsTab defaultDate={defaultDate} />
      ) : (
        <BuildingsTab defaultDate={defaultDate} />
      )}
    </>
  );
}
