import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, MenuItem, Paper, Stack, TextField } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm, type Control } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { TENANT_CIVIL_STATUSES } from '../../api/contract';
import { ApiError } from '../../api/problem';
import { PageHeader } from '../../components/data-display/PageHeader';
import { tenantsApi } from './api';
import { civilStatusLabel } from './labels';
import { createTenantSchema, type CreateTenantForm } from './schemas';

export function NewTenantPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createTenant = useMutation({ mutationFn: tenantsApi.create });
  const { control, handleSubmit } = useForm<CreateTenantForm>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      cpf: '',
      rg: '',
      profession: '',
      civilStatus: 'SINGLE',
      email: '',
      mobilePhone: '',
    },
  });
  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await createTenant.mutateAsync({
        ...values,
        email: values.email.trim().toLowerCase(),
      });
      queryClient.setQueryData(['tenant', created.id], created);
      await queryClient.invalidateQueries({ queryKey: ['tenants'] });
      void navigate(`/tenants/${created.id}`, { replace: true });
    } catch {
      // A mutação mantém o problema disponível para a mensagem persistente abaixo.
    }
  });
  const apiMessage =
    createTenant.error instanceof ApiError ? createTenant.error.problem.detail : null;

  return (
    <>
      <PageHeader
        title="Novo locatário"
        description="Cadastre os dados necessários para uma locação."
      />
      <Paper variant="outlined" sx={{ maxWidth: 720, p: { xs: 2, sm: 3 } }}>
        <Stack component="form" spacing={2.5} onSubmit={onSubmit} noValidate>
          {apiMessage && <Alert severity="error">{apiMessage}</Alert>}
          <BoxFields control={control} />
          <Stack
            direction={{ xs: 'column-reverse', sm: 'row' }}
            spacing={1}
            sx={{ justifyContent: 'flex-end' }}
          >
            <Button
              variant="text"
              onClick={() => void navigate('/tenants')}
              disabled={createTenant.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createTenant.isPending}
              aria-busy={createTenant.isPending}
            >
              {createTenant.isPending ? 'Cadastrando…' : 'Cadastrar locatário'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </>
  );
}

function BoxFields({ control }: { control: Control<CreateTenantForm> }) {
  return (
    <>
      <Controller
        name="cpf"
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            label="CPF"
            inputMode="numeric"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
          />
        )}
      />
      <Controller
        name="rg"
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            label="RG"
            error={fieldState.invalid}
            helperText={fieldState.error?.message ?? 'O RG não será exibido depois do cadastro.'}
          />
        )}
      />
      <Controller
        name="profession"
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            label="Profissão"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
          />
        )}
      />
      <Controller
        name="civilStatus"
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            select
            label="Estado civil"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
          >
            {TENANT_CIVIL_STATUSES.map((status) => (
              <MenuItem key={status} value={status}>
                {civilStatusLabel(status)}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
      <Controller
        name="email"
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            type="email"
            label="E-mail"
            autoComplete="email"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
          />
        )}
      />
      <Controller
        name="mobilePhone"
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            type="tel"
            label="Celular"
            autoComplete="tel"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
          />
        )}
      />
    </>
  );
}
