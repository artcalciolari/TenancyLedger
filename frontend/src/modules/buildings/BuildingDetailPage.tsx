import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Box,
  Button,
  Card,
  MenuItem,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router';
import { queryKeys } from '../../api/query-keys';
import { invalidateBuildingEditCaches } from '../../api/edit-cache-invalidation';
import { brand } from '../../app/theme/theme';
import {
  BuildingOccupancyChip,
  UnitOccupancyChip,
} from '../../components/data-display/OccupancyChip';
import { TechnicalDetails } from '../../components/data-display/TechnicalDetails';
import { EmptyState } from '../../components/feedback/QueryState';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { LoadingState } from '../../components/feedback/QueryState';
import { useAuth } from '../auth/useAuth';
import { hasRole, MANAGEMENT_ROLES } from '../../lib/roles/roles';
import { buildingsApi } from './api';
import { EditBuildingDialog } from './EditBuildingDialog';
import type { UpdateBuildingInput } from '../../api/contract';

const uppercaseLabelSx = {
  fontSize: '0.78rem',
  fontWeight: 600,
  letterSpacing: '0.03em',
  textTransform: 'uppercase' as const,
  color: brand.textTertiary,
};

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography sx={uppercaseLabelSx}>{label}</Typography>
      <Typography sx={{ overflowWrap: 'anywhere', mt: 0.5, color: brand.textPrimary }}>
        {value}
      </Typography>
    </Box>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        p: 1.75,
        borderRadius: '10px',
        bgcolor: brand.surfaceSubtle,
        border: `1px solid ${brand.borderCard}`,
      }}
    >
      <Typography sx={uppercaseLabelSx}>{label}</Typography>
      <Typography sx={{ mt: 0.65, fontSize: '1.1rem', fontWeight: 650, color: brand.textPrimary }}>
        {value}
      </Typography>
    </Box>
  );
}

export function BuildingDetailPage() {
  const { buildingId = '' } = useParams();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [roomFilter, setRoomFilter] = useState<'ALL' | 'VACANT' | 'OCCUPIED'>('ALL');
  const building = useQuery({
    queryKey: queryKeys.building(buildingId),
    queryFn: () => buildingsApi.get(buildingId),
    enabled: Boolean(buildingId),
  });
  const updateBuilding = useMutation({
    mutationFn: (input: UpdateBuildingInput) => buildingsApi.update(buildingId, input),
  });
  const mayEdit = Boolean(session && hasRole(session.user.role, MANAGEMENT_ROLES));
  const visibleRooms = useMemo(() => {
    const rows = building.data?.rooms ?? [];
    if (roomFilter === 'VACANT') return rows.filter((room) => !room.occupied);
    if (roomFilter === 'OCCUPIED') return rows.filter((room) => room.occupied);
    return rows;
  }, [building.data?.rooms, roomFilter]);

  const submitEdit = async (input: UpdateBuildingInput) => {
    const updated = await updateBuilding.mutateAsync(input);
    queryClient.setQueryData(queryKeys.building(buildingId), updated);
    await invalidateBuildingEditCaches(queryClient);
  };

  const closeEdit = () => {
    updateBuilding.reset();
    setEditOpen(false);
  };

  return (
    <>
      <Stack
        direction="row"
        component={RouterLink}
        to="/portfolio"
        spacing={0.75}
        sx={{
          alignItems: 'center',
          width: 'fit-content',
          mb: 1.75,
          color: brand.textSecondary,
          textDecoration: 'none',
          fontSize: '0.88rem',
          fontWeight: 600,
          '&:hover': { color: brand.textPrimary },
        }}
      >
        <ArrowBackOutlined sx={{ fontSize: 19 }} />
        Voltar para portfólio
      </Stack>
      {building.isPending ? (
        <LoadingState label="Carregando prédio…" />
      ) : building.isError ? (
        <ProblemAlert error={building.error} onRetry={() => void building.refetch()} />
      ) : (
        <>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.75}
            sx={{ alignItems: { sm: 'center' }, mb: 3 }}
          >
            <Stack direction="row" spacing={1.75} sx={{ alignItems: 'center' }}>
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: '14px',
                  bgcolor: brand.accentTint,
                  color: brand.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ApartmentOutlinedIcon sx={{ fontSize: 26 }} />
              </Box>
              <Box>
                <Typography component="h1" variant="h1">
                  {building.data.name}
                </Typography>
                <Typography sx={{ color: brand.textSecondary }}>
                  {building.data.neighborhood}
                  {building.data.address ? ` · ${building.data.address}` : ''}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ ml: { sm: 'auto' }, alignItems: 'center' }}>
              {mayEdit ? (
                <Button
                  component={RouterLink}
                  variant="outlined"
                  to={`/rooms/new?buildingId=${buildingId}`}
                >
                  Adicionar quarto
                </Button>
              ) : null}
              {mayEdit ? (
                <Button
                  variant="outlined"
                  startIcon={<EditOutlinedIcon />}
                  onClick={() => {
                    updateBuilding.reset();
                    setEditOpen(true);
                  }}
                >
                  Editar
                </Button>
              ) : null}
              <BuildingOccupancyChip
                occupiedRooms={building.data.occupiedRooms}
                totalRooms={building.data.totalRooms}
              />
            </Stack>
          </Stack>
          <Card sx={{ p: { xs: 2.25, sm: 2.75 }, mb: 2.5 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 3,
              }}
            >
              <DetailField label="Bairro" value={building.data.neighborhood} />
              <DetailField label="Endereço" value={building.data.address ?? '—'} />
            </Box>
            <Box
              sx={{
                mt: 2.5,
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(4, minmax(0, 1fr))',
                },
                gap: 1.5,
              }}
            >
              <SummaryMetric label="Total de quartos" value={String(building.data.totalRooms)} />
              <SummaryMetric label="Ocupados" value={String(building.data.occupiedRooms)} />
              <SummaryMetric label="Vagos" value={String(building.data.vacantRooms)} />
              <SummaryMetric
                label="Vacância"
                value={
                  building.data.totalRooms === 0 || building.data.vacancyPercentage === null
                    ? 'Sem quartos'
                    : `${building.data.vacancyPercentage.toFixed(1).replace('.0', '')}%`
                }
              />
            </Box>
            <TechnicalDetails id={building.data.id} />
          </Card>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ alignItems: { sm: 'center' }, mb: 1.5 }}
          >
            <Typography component="h2" variant="h2">
              Quartos
            </Typography>
            <TextField
              select
              size="small"
              label="Situação"
              value={roomFilter}
              onChange={(event) =>
                setRoomFilter(event.target.value as 'ALL' | 'VACANT' | 'OCCUPIED')
              }
              sx={{ width: { xs: '100%', sm: 220 }, ml: { sm: 'auto' } }}
            >
              <MenuItem value="ALL">Todos</MenuItem>
              <MenuItem value="VACANT">Vagos</MenuItem>
              <MenuItem value="OCCUPIED">Ocupados</MenuItem>
            </TextField>
          </Stack>
          {building.data.rooms.length === 0 ? (
            <EmptyState title="Nenhum quarto vinculado a este prédio" />
          ) : visibleRooms.length === 0 ? (
            <Card sx={{ p: 1 }}>
              <EmptyState
                title="Nenhum quarto corresponde à situação selecionada"
                description="Ajuste o filtro para visualizar outros quartos deste prédio."
              />
            </Card>
          ) : (
            <Card sx={{ p: 0 }}>
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table sx={{ minWidth: 480 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Quarto</TableCell>
                      <TableCell>Situação</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visibleRooms.map((room) => (
                      <TableRow key={room.id} hover>
                        <TableCell>
                          <Typography
                            component={RouterLink}
                            to={`/rooms/${room.id}`}
                            sx={{
                              fontWeight: 600,
                              color: brand.textPrimary,
                              textDecoration: 'none',
                              '&:hover': { color: brand.accent },
                            }}
                          >
                            {room.number}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <UnitOccupancyChip occupied={room.occupied} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          )}
          <EditBuildingDialog
            building={building.data}
            open={editOpen}
            isPending={updateBuilding.isPending}
            error={updateBuilding.error}
            onClose={closeEdit}
            onSubmit={submitEdit}
          />
        </>
      )}
    </>
  );
}
