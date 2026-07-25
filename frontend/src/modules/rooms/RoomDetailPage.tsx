import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Box, Button, Card, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link as RouterLink, useParams } from 'react-router';
import type { UpdateRoomInput } from '../../api/contract';
import { queryKeys } from '../../api/query-keys';
import { brand } from '../../app/theme/theme';
import { UnitOccupancyChip } from '../../components/data-display/OccupancyChip';
import { TechnicalDetails } from '../../components/data-display/TechnicalDetails';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { LoadingState } from '../../components/feedback/QueryState';
import { formatDateTime } from '../../lib/dates/dates';
import { hasRole, MANAGEMENT_ROLES } from '../../lib/roles/roles';
import { useAuth } from '../auth/useAuth';
import { roomsApi } from './api';
import { EditRoomDialog } from './EditRoomDialog';

const uppercaseLabelSx = {
  fontSize: '0.78rem',
  fontWeight: 600,
  letterSpacing: '0.03em',
  textTransform: 'uppercase' as const,
  color: brand.textTertiary,
};

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box>
      <Typography sx={uppercaseLabelSx}>{label}</Typography>
      <Typography sx={{ overflowWrap: 'anywhere', mt: 0.5, color: brand.textPrimary }}>
        {value}
      </Typography>
    </Box>
  );
}

export function RoomDetailPage() {
  const { roomId = '' } = useParams();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const room = useQuery({
    queryKey: queryKeys.room(roomId),
    queryFn: () => roomsApi.get(roomId),
    enabled: Boolean(roomId),
  });
  const updateRoom = useMutation({
    mutationFn: (input: UpdateRoomInput) => roomsApi.update(roomId, input),
  });
  const mayEdit = Boolean(session && hasRole(session.user.role, MANAGEMENT_ROLES));

  const submitEdit = async (input: UpdateRoomInput) => {
    const updated = await updateRoom.mutateAsync(input);
    queryClient.setQueryData(queryKeys.room(roomId), updated);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['rooms'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.building(updated.buildingId) }),
      queryClient.invalidateQueries({ queryKey: ['buildings'] }),
    ]);
  };

  const closeEdit = () => {
    updateRoom.reset();
    setEditOpen(false);
  };
  return (
    <>
      <Stack
        direction="row"
        component={RouterLink}
        to="/portfolio?tab=rooms"
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
      {room.isPending ? (
        <LoadingState label="Carregando quarto…" />
      ) : room.isError ? (
        <ProblemAlert error={room.error} onRetry={() => void room.refetch()} />
      ) : (
        <>
          <Stack direction="row" spacing={1.75} sx={{ alignItems: 'center', mb: 3 }}>
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
              <BedOutlinedIcon sx={{ fontSize: 26 }} />
            </Box>
            <Box>
              <Typography component="h1" variant="h1">
                Quarto {room.data.number}
              </Typography>
              <Typography sx={{ color: brand.textSecondary }}>{room.data.buildingName}</Typography>
            </Box>
            {mayEdit ? (
              <Button
                variant="outlined"
                startIcon={<EditOutlinedIcon />}
                sx={{ ml: 'auto' }}
                onClick={() => {
                  updateRoom.reset();
                  setEditOpen(true);
                }}
              >
                Editar
              </Button>
            ) : null}
          </Stack>
          <Card sx={{ p: { xs: 2.25, sm: 2.75 } }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 3,
              }}
            >
              <DetailField label="Número do quarto" value={room.data.number} />
              <DetailField
                label="Prédio"
                value={
                  <Typography
                    component={RouterLink}
                    to={`/buildings/${room.data.buildingId}`}
                    sx={{ color: brand.accent, fontWeight: 600, textDecoration: 'none' }}
                  >
                    {room.data.buildingName}
                  </Typography>
                }
              />
              <DetailField
                label="Situação"
                value={<UnitOccupancyChip occupied={room.data.occupied} />}
              />
              <DetailField label="Cadastrado em" value={formatDateTime(room.data.createdAt)} />
            </Box>
            <TechnicalDetails id={room.data.id} />
          </Card>
          <EditRoomDialog
            room={room.data}
            open={editOpen}
            isPending={updateRoom.isPending}
            error={updateRoom.error}
            onClose={closeEdit}
            onSubmit={submitEdit}
          />
        </>
      )}
    </>
  );
}
