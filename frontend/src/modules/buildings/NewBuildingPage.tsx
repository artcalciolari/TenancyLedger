import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Card, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { ApiError } from '../../api/problem';
import { PageHeader } from '../../components/data-display/PageHeader';
import { buildingsApi } from './api';
import { createBuildingSchema, type CreateBuildingForm } from './schemas';

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

export function NewBuildingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createBuilding = useMutation({ mutationFn: buildingsApi.create });
  const { control, handleSubmit } = useForm<CreateBuildingForm>({
    resolver: zodResolver(createBuildingSchema),
    defaultValues: { name: '', neighborhood: '', address: '' },
  });
  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await createBuilding.mutateAsync({
        ...values,
        address: values.address === '' ? undefined : values.address,
      });
      queryClient.setQueryData(['building', created.id], created);
      await queryClient.invalidateQueries({ queryKey: ['buildings'] });
      void navigate(`/buildings/${created.id}`, { replace: true });
    } catch {
      // A mutação mantém o problema disponível para a mensagem persistente abaixo.
    }
  });
  const apiMessage =
    createBuilding.error instanceof ApiError ? createBuilding.error.problem.detail : null;

  return (
    <>
      <PageHeader title="Novo prédio" description="Cadastre um edifício para agrupar unidades." />
      <Card sx={{ maxWidth: 960, p: { xs: 2, sm: 3.5 } }}>
        <Stack component="form" spacing={3} onSubmit={onSubmit} noValidate>
          {apiMessage && <Alert severity="error">{apiMessage}</Alert>}
          <Box>
            <SectionLabel>Dados do prédio</SectionLabel>
            <Box sx={fieldGridSx}>
              <Controller
                name="name"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Nome do prédio"
                    error={fieldState.invalid}
                    helperText={fieldState.error?.message}
                  />
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
                name="address"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Endereço"
                    error={fieldState.invalid}
                    helperText={fieldState.error?.message ?? 'Opcional.'}
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
              onClick={() => void navigate('/buildings')}
              disabled={createBuilding.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createBuilding.isPending}
              aria-busy={createBuilding.isPending}
            >
              {createBuilding.isPending ? 'Cadastrando…' : 'Cadastrar prédio'}
            </Button>
          </Stack>
        </Stack>
      </Card>
    </>
  );
}
