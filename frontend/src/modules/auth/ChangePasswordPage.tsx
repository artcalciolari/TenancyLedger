import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Paper, Stack, TextField } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { ApiError } from '../../api/problem';
import { PageHeader } from '../../components/data-display/PageHeader';
import { authApi } from './api';
import { changePasswordSchema, type ChangePasswordForm } from './change-password.schema';
import { useAuth } from './useAuth';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { endSession } = useAuth();
  const changePassword = useMutation({ mutationFn: authApi.changePassword });
  const { control, handleSubmit } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const onSubmit = handleSubmit(async (values) => {
    try {
      await changePassword.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      endSession('logged-out');
      void navigate('/login?reason=password-changed', { replace: true });
    } catch {
      // A mutação mantém o problema disponível para a mensagem persistente abaixo.
    }
  });
  const apiMessage =
    changePassword.error instanceof ApiError ? changePassword.error.problem.detail : null;

  return (
    <>
      <PageHeader
        title="Trocar senha"
        description="Ao concluir, será necessário entrar novamente."
      />
      <Paper variant="outlined" sx={{ maxWidth: 640, p: { xs: 2, sm: 3 } }}>
        <Stack component="form" spacing={2.5} onSubmit={onSubmit} noValidate>
          {apiMessage && <Alert severity="error">{apiMessage}</Alert>}
          <Controller
            name="currentPassword"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Senha atual"
                type="password"
                autoComplete="current-password"
                error={fieldState.invalid}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="newPassword"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Nova senha"
                type="password"
                autoComplete="new-password"
                error={fieldState.invalid}
                helperText={
                  fieldState.error?.message ??
                  'Mínimo de 12 caracteres, com maiúscula, minúscula, número e símbolo.'
                }
              />
            )}
          />
          <Controller
            name="confirmPassword"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Confirmar nova senha"
                type="password"
                autoComplete="new-password"
                error={fieldState.invalid}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <Stack
            direction={{ xs: 'column-reverse', sm: 'row' }}
            spacing={1}
            sx={{ justifyContent: 'flex-end' }}
          >
            <Button
              variant="text"
              onClick={() => void navigate(-1)}
              disabled={changePassword.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={changePassword.isPending}
              aria-busy={changePassword.isPending}
            >
              {changePassword.isPending ? 'Alterando…' : 'Alterar senha'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </>
  );
}
