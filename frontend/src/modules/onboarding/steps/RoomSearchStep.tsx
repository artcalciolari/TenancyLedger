import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
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
import { UNIT_TYPES, type UnitType } from '../../../api/contract';
import { ProblemAlert } from '../../../components/feedback/ProblemAlert';
import { EmptyState, LoadingState } from '../../../components/feedback/QueryState';
import { unitTypeLabel } from '../../properties/labels';
import { onboardingApi } from '../api';
import type { AvailableProperty, AvailablePropertyFilters } from '../types';

interface RoomSearchStepProps {
  moveInDate: string;
  selectedId: string | null;
  error?: string;
  onDateChange: (date: string) => void;
  onSelect: (property: AvailableProperty) => void;
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
  const [filters, setFilters] = useState<AvailablePropertyFilters>({ date: moveInDate });
  const [formKey, setFormKey] = useState(0);
  const properties = useQuery({
    queryKey: ['properties', 'available', filters],
    queryFn: () => onboardingApi.availableProperties(filters),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const date = formValue(data, 'date');
    const neighborhood = formValue(data, 'neighborhood');
    const rawType = formValue(data, 'type');
    const type = UNIT_TYPES.includes(rawType as UnitType) ? (rawType as UnitType) : undefined;
    onDateChange(date);
    setFilters({ date, neighborhood: neighborhood || undefined, type });
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
              gridTemplateColumns: { xs: '1fr', md: '190px minmax(220px, 1fr) 210px auto' },
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
              name="neighborhood"
              label="Bairro"
              defaultValue={filters.neighborhood ?? ''}
              slotProps={{ htmlInput: { maxLength: 120 } }}
            />
            <TextField name="type" select label="Tipo" defaultValue={filters.type ?? ''}>
              <MenuItem value="">Todos</MenuItem>
              {UNIT_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {unitTypeLabel(type)}
                </MenuItem>
              ))}
            </TextField>
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

      {properties.isPending ? (
        <LoadingState label="Buscando quartos disponíveis…" />
      ) : properties.isError ? (
        <ProblemAlert error={properties.error} onRetry={() => void properties.refetch()} />
      ) : properties.data.length === 0 ? (
        <EmptyState
          title="Nenhum quarto disponível"
          description="Tente outra data, bairro ou tipo de unidade."
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
          {properties.data.map((property) => {
            const selected = property.id === selectedId;
            return (
              <Card
                key={property.id}
                sx={{
                  borderColor: selected ? 'primary.main' : undefined,
                  borderWidth: selected ? 2 : 1,
                  bgcolor: selected ? 'primary.50' : undefined,
                }}
              >
                <CardActionArea
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onSelect(property)}
                  sx={{ minHeight: 132, alignItems: 'stretch' }}
                >
                  <CardContent>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                      <ApartmentOutlinedIcon color={selected ? 'primary' : 'action'} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                          <Typography variant="h2" sx={{ flex: 1 }}>
                            Unidade {property.unitNumber}
                          </Typography>
                          {selected && <Chip color="primary" size="small" label="Selecionado" />}
                        </Stack>
                        <Typography>{property.neighborhood}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {unitTypeLabel(property.type)}
                          {property.buildingName ? ` · ${property.buildingName}` : ''}
                        </Typography>
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
