import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Card, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { UNIT_TYPES } from '../../api/contract';
import { ApiError } from '../../api/problem';
import { queryKeys } from '../../api/query-keys';
import { PageHeader } from '../../components/data-display/PageHeader';
import { buildingsApi } from '../buildings/api';
import { propertiesApi } from './api';
import { unitTypeLabel } from './labels';
import { createPropertySchema, type CreatePropertyForm } from './schemas';

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

export function NewPropertyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createProperty = useMutation({ mutationFn: propertiesApi.create });
  const buildings = useQuery({
    queryKey: queryKeys.buildings({ page: 1, limit: 100 }),
    queryFn: () => buildingsApi.list({ page: 1, limit: 100 }),
  });
  const { control, handleSubmit, setValue } = useForm<CreatePropertyForm>({
    resolver: zodResolver(createPropertySchema),
    defaultValues: { neighborhood: '', type: 'APARTMENT', unitNumber: '', buildingId: '' },
  });
  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await createProperty.mutateAsync({
        ...values,
        buildingId: values.buildingId === '' ? undefined : values.buildingId,
      });
      queryClient.setQueryData(['property', created.id], created);
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      void navigate(`/properties/${created.id}`, { replace: true });
    } catch {
      // A mutação mantém o problema disponível para a mensagem persistente abaixo.
    }
  });
  const apiMessage =
    createProperty.error instanceof ApiError ? createProperty.error.problem.detail : null;

  return (
    <>
      <PageHeader title="Novo imóvel" description="Cadastre uma unidade imobiliária." />
      <Card sx={{ maxWidth: 960, p: { xs: 2, sm: 3.5 } }}>
        <Stack component="form" spacing={3} onSubmit={onSubmit} noValidate>
          {apiMessage && <Alert severity="error">{apiMessage}</Alert>}
          <Box>
            <SectionLabel>Dados do imóvel</SectionLabel>
            <Box sx={fieldGridSx}>
              <Controller
                name="buildingId"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    select
                    label="Prédio"
                    error={fieldState.invalid}
                    helperText={fieldState.error?.message}
                    onChange={(event) => {
                      const buildingId = event.target.value;
                      field.onChange(buildingId);
                      const building = buildings.data?.data.find((item) => item.id === buildingId);
                      if (building) setValue('neighborhood', building.neighborhood);
                    }}
                  >
                    <MenuItem value="">Sem prédio</MenuItem>
                    {(buildings.data?.data ?? []).map((building) => (
                      <MenuItem key={building.id} value={building.id}>
                        {building.name}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
              <Controller
                name="neighborhood"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Bairro"
                    error={fieldState.invalid}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="unitNumber"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Número da unidade"
                    error={fieldState.invalid}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="type"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    select
                    label="Tipo"
                    error={fieldState.invalid}
                    helperText={fieldState.error?.message}
                  >
                    {UNIT_TYPES.map((type) => (
                      <MenuItem key={type} value={type}>
                        {unitTypeLabel(type)}
                      </MenuItem>
                    ))}
                  </TextField>
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
              onClick={() => void navigate('/properties')}
              disabled={createProperty.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createProperty.isPending}
              aria-busy={createProperty.isPending}
            >
              {createProperty.isPending ? 'Cadastrando…' : 'Cadastrar imóvel'}
            </Button>
          </Stack>
        </Stack>
      </Card>
    </>
  );
}
