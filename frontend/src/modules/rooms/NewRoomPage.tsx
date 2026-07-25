import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Card, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../../api/problem';
import { queryKeys } from '../../api/query-keys';
import { PageHeader } from '../../components/data-display/PageHeader';
import { isUuidV4 } from '../../lib/identifiers/uuid';
import { buildingsApi } from '../buildings/api';
import { roomsApi } from './api';
import { createRoomSchema, type CreateRoomForm } from './schemas';

const fieldGridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fit, minmax(240px, 1fr))' },
  gap: 2.25,
} as const;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: '0.75rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'primary.main',
        mb: 2,
      }}
    >
      {children}
    </Typography>
  );
}

export function NewRoomPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedBuildingId = searchParams.get('buildingId') ?? '';
  const presetBuildingId = isUuidV4(requestedBuildingId) ? requestedBuildingId : '';
  const lockedToBuilding = presetBuildingId !== '';
  const queryClient = useQueryClient();
  const createRoom = useMutation({ mutationFn: roomsApi.create });
  const buildings = useQuery({
    queryKey: queryKeys.buildings({ page: 1, limit: 100 }),
    queryFn: () => buildingsApi.list({ page: 1, limit: 100 }),
    enabled: !lockedToBuilding,
  });
  const presetBuilding = useQuery({
    queryKey: queryKeys.building(presetBuildingId),
    queryFn: () => buildingsApi.get(presetBuildingId),
    enabled: lockedToBuilding,
  });
  const { control, handleSubmit } = useForm<CreateRoomForm>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: { buildingId: presetBuildingId, number: '' },
  });
  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await createRoom.mutateAsync(values);
      queryClient.setQueryData(queryKeys.room(created.id), created);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rooms'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.building(created.buildingId) }),
        queryClient.invalidateQueries({ queryKey: ['buildings'] }),
      ]);
      void navigate(`/rooms/${created.id}`, { replace: true });
    } catch {
      // A mutação mantém o problema disponível para a mensagem persistente abaixo.
    }
  });
  const apiMessage = createRoom.error instanceof ApiError ? createRoom.error.problem.detail : null;

  return (
    <>
      <PageHeader title="Novo quarto" description="Cadastre um quarto vinculado a um prédio." />
      <Card sx={{ maxWidth: 960, p: { xs: 2, sm: 3.5 } }}>
        <Stack component="form" spacing={3} onSubmit={onSubmit} noValidate>
          {apiMessage && <Alert severity="error">{apiMessage}</Alert>}
          {presetBuilding.isError && (
            <Alert severity="error">
              Não foi possível carregar o prédio selecionado. Volte ao detalhe do prédio e tente
              novamente.
            </Alert>
          )}
          <Box>
            <SectionLabel>Dados do quarto</SectionLabel>
            <Box sx={fieldGridSx}>
              <Controller
                name="buildingId"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    select
                    label="Prédio"
                    disabled={lockedToBuilding}
                    error={fieldState.invalid}
                    helperText={
                      fieldState.error?.message ??
                      (lockedToBuilding ? 'Vínculo definido pelo prédio selecionado.' : undefined)
                    }
                  >
                    {lockedToBuilding && (
                      <MenuItem value={presetBuildingId}>
                        {presetBuilding.data?.name ??
                          (presetBuilding.isError ? 'Prédio indisponível' : 'Carregando prédio…')}
                      </MenuItem>
                    )}
                    {(buildings.data?.data ?? []).map((building) => (
                      <MenuItem key={building.id} value={building.id}>
                        {building.name}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
              <Controller
                name="number"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Número do quarto"
                    error={fieldState.invalid}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Box>
          </Box>
          <Stack
            direction={{ xs: 'column-reverse', sm: 'row' }}
            spacing={1}
            sx={{ justifyContent: 'flex-end' }}
          >
            <Button
              variant="text"
              onClick={() =>
                void navigate(
                  lockedToBuilding ? `/buildings/${presetBuildingId}` : '/portfolio?tab=rooms',
                )
              }
              disabled={createRoom.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createRoom.isPending || presetBuilding.isError}
              aria-busy={createRoom.isPending}
            >
              {createRoom.isPending ? 'Cadastrando…' : 'Cadastrar quarto'}
            </Button>
          </Stack>
        </Stack>
      </Card>
    </>
  );
}
