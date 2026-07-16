import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { TENANT_CIVIL_STATUSES, type TenantView, type UpdateTenantInput } from '../../api/contract';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { civilStatusLabel } from './labels';
import { updateTenantSchema, type UpdateTenantForm } from './schemas';

interface EditTenantDialogProps {
  tenant: TenantView;
  open: boolean;
  isPending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (input: UpdateTenantInput) => Promise<void>;
}

export function EditTenantDialog({
  tenant,
  open,
  isPending,
  error,
  onClose,
  onSubmit,
}: EditTenantDialogProps) {
  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = useForm<UpdateTenantForm>({
    resolver: zodResolver(updateTenantSchema),
    defaultValues: {
      name: tenant.name,
      profession: tenant.profession,
      civilStatus: tenant.civilStatus,
      email: tenant.email,
      mobilePhone: tenant.mobilePhone,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: tenant.name,
        profession: tenant.profession,
        civilStatus: tenant.civilStatus,
        email: tenant.email,
        mobilePhone: tenant.mobilePhone,
      });
    }
  }, [open, reset, tenant]);

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
      onClose();
    } catch {
      // O erro da mutação é exibido pelo ProblemAlert.
    }
  });

  return (
    <Dialog open={open} onClose={isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Editar locatário</DialogTitle>
      <DialogContent dividers>
        <Stack component="form" id="edit-tenant-form" spacing={2.25} onSubmit={submit} noValidate>
          <Alert severity="info">
            CPF e RG são imutáveis e não podem ser corrigidos nesta edição.
          </Alert>
          {error ? <ProblemAlert error={error} /> : null}
          <TextField
            {...register('name')}
            label="Nome completo"
            autoFocus
            error={Boolean(errors.name)}
            helperText={errors.name?.message}
          />
          <TextField
            {...register('profession')}
            label="Profissão"
            error={Boolean(errors.profession)}
            helperText={errors.profession?.message}
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
          <TextField
            {...register('email')}
            label="E-mail"
            type="email"
            error={Boolean(errors.email)}
            helperText={errors.email?.message}
          />
          <TextField
            {...register('mobilePhone')}
            label="Celular"
            error={Boolean(errors.mobilePhone)}
            helperText={errors.mobilePhone?.message}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" form="edit-tenant-form" disabled={isPending} aria-busy={isPending}>
          {isPending ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
