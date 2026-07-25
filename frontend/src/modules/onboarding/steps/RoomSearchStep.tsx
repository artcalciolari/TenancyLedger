import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ProblemAlert } from '../../../components/feedback/ProblemAlert';
import { EmptyState, LoadingState } from '../../../components/feedback/QueryState';
import { buildingsApi } from '../../buildings/api';
import { onboardingApi } from '../api';
import type { AvailableRoom, AvailableRoomFilters } from '../types';

interface RoomSearchStepProps {
  moveInDate: string;
  selectedId: string | null;
  error?: string;
  onDateChange: (date: string) => void;
  onSelect: (room: AvailableRoom) => void;
}

function formValue(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export function RoomSearchStep({
  moveInDate,
  selectedId,
  error,
  onDateChange,
  onSelect,
}: RoomSearchStepProps) {
  const [filters, setFilters] = useState<AvailableRoomFilters>({ date: moveInDate });
  const [formKey, setFormKey] = useState(0);
  const buildings = useQuery({
    queryKey: ['buildings', 'onboarding-options'],
    queryFn: () => buildingsApi.list({ page: 1, limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });
  const rooms = useQuery({
    queryKey: ['rooms', 'available', filters],
    queryFn: () => onboardingApi.availableRooms(filters),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const date = formValue(data, 'date');
    const q = formValue(data, 'q');
    const buildingId = formValue(data, 'buildingId');
    onDateChange(date);
    setFilters({ date, q: q || undefined, buildingId: buildingId || undefined });
  };

  const clear = () => {
    setFilters({ date: moveInDate });
    setFormKey((value) => value + 1);
  };

  return (
    <Box>
      <Typography variant="h1" component="h2" sx={{ mb: 0.75 }}>
        Escolha o quarto
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        A disponibilidade considera a data de entrada e contratos já existentes.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Card component="form" onSubmit={submit} key={formKey} sx={{ mb: 2.5 }}>
        <CardContent>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: '190px minmax(180px, 0.8fr) minmax(220px, 1fr) auto',
              },
              gap: 1.5,
              alignItems: 'start',
            }}
          >
            <TextField
              name="date"
              label="Data de entrada"
              type="date"
              defaultValue={filters.date}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: '2000-01-01' } }}
              required
            />
            <TextField
              select
              name="buildingId"
              label="Prédio"
              defaultValue={filters.buildingId ?? ''}
              disabled={buildings.isPending}
              error={buildings.isError}
              helperText={buildings.isError ? 'Não foi possível carregar os prédios.' : undefined}
            >
              <MenuItem value="">Todos os prédios</MenuItem>
              {(buildings.data?.data ?? []).map((building) => (
                <MenuItem key={building.id} value={building.id}>
                  {building.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              name="q"
              label="Prédio, bairro, endereço ou número"
              defaultValue={filters.q ?? ''}
              slotProps={{ htmlInput: { maxLength: 120 } }}
            />
            <Stack direction="row" spacing={1}>
              <Button type="submit" startIcon={<SearchOutlinedIcon />}>
                Buscar
              </Button>
              <Button type="button" variant="text" onClick={clear}>
                Limpar
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {rooms.isPending ? (
        <LoadingState label="Buscando quartos disponíveis…" />
      ) : rooms.isError ? (
        <ProblemAlert error={rooms.error} onRetry={() => void rooms.refetch()} />
      ) : rooms.data.length === 0 ? (
        <EmptyState
          title="Nenhum quarto disponível"
          description="Tente outra data ou termo de busca."
        />
      ) : (
        <Box
          role="radiogroup"
          aria-label="Quartos disponíveis"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          {rooms.data.map((room) => {
            const selected = room.id === selectedId;
            return (
              <Card
                key={room.id}
                sx={{
                  borderColor: selected ? 'primary.main' : undefined,
                  borderWidth: selected ? 2 : 1,
                  bgcolor: selected ? 'primary.50' : undefined,
                }}
              >
                <CardActionArea
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onSelect(room)}
                  sx={{ minHeight: 132, alignItems: 'stretch' }}
                >
                  <CardContent>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                      <BedOutlinedIcon color={selected ? 'primary' : 'action'} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                          <Typography variant="h2" sx={{ flex: 1 }}>
                            Quarto {room.number}
                          </Typography>
                          {selected && <Chip color="primary" size="small" label="Selecionado" />}
                        </Stack>
                        <Typography>{room.buildingName ?? '—'}</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
