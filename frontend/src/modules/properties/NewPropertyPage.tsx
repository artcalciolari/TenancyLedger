import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, MenuItem, Paper, Stack, TextField } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { UNIT_TYPES } from '../../api/contract';
import { ApiError } from '../../api/problem';
import { PageHeader } from '../../components/data-display/PageHeader';
import { propertiesApi } from './api';
import { unitTypeLabel } from './labels';
import { createPropertySchema, type CreatePropertyForm } from './schemas';

export function NewPropertyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createProperty = useMutation({ mutationFn: propertiesApi.create });
  const { control, handleSubmit } = useForm<CreatePropertyForm>({
    resolver: zodResolver(createPropertySchema),
    defaultValues: { neighborhood: '', type: 'APARTMENT', unitNumber: '' },
  });
  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await createProperty.mutateAsync(values);
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
      <Paper variant="outlined" sx={{ maxWidth: 640, p: { xs: 2, sm: 3 } }}>
        <Stack component="form" spacing={2.5} onSubmit={onSubmit} noValidate>
          {apiMessage && <Alert severity="error">{apiMessage}</Alert>}
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
      </Paper>
    </>
  );
}
