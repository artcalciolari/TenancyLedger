import { zodResolver } from '@hookform/resolvers/zod';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import MailOutlineIcon from '@mui/icons-material/MailOutlineOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { Alert, Button, IconButton, InputAdornment, Stack, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { ApiError } from '../../api/problem';
import { authApi } from './api';
import { useAuth } from './useAuth';

const loginSchema = z.object({
  email: z
    .email('Informe um e-mail válido.')
    .max(254, 'O e-mail deve ter no máximo 254 caracteres.'),
  password: z
    .string()
    .min(8, 'A senha deve ter no mínimo 8 caracteres.')
    .max(128, 'A senha deve ter no máximo 128 caracteres.'),
});

type LoginForm = z.infer<typeof loginSchema>;

function safeReturnTo(value: string | null): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
}

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, reason, startSession } = useAuth();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (searchParams.get('reason') === 'session-expired') {
      document.title = 'Sessão expirada | Tenancy Ledger';
    }
    return () => {
      document.title = 'Tenancy Ledger';
    };
  }, [searchParams]);

  if (session) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (values: LoginForm) => {
    try {
      const response = await authApi.login({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });
      startSession(response);
      void navigate(safeReturnTo(searchParams.get('returnTo')), { replace: true });
    } catch (error: unknown) {
      const message =
        error instanceof ApiError && error.status === 429
          ? 'Muitas tentativas. Aguarde um momento antes de tentar novamente.'
          : error instanceof ApiError
            ? error.problem.detail
            : 'Não foi possível entrar. Tente novamente.';
      setError('root', { message });
    }
  };

  const sessionExpired = searchParams.get('reason') === 'session-expired' || reason === 'expired';
  const passwordChanged = searchParams.get('reason') === 'password-changed';
  const focusFirstError = () =>
    window.requestAnimationFrame(() => document.getElementById('login-email')?.focus());

  return (
    <Stack
      component="form"
      spacing={2.5}
      onSubmit={handleSubmit(onSubmit, focusFirstError)}
      noValidate
    >
      {sessionExpired && (
        <Alert severity="info">Sua sessão expirou. Entre novamente para continuar.</Alert>
      )}
      {passwordChanged && (
        <Alert severity="success">Senha alterada. Entre novamente para continuar.</Alert>
      )}
      {errors.root?.message && <Alert severity="error">{errors.root.message}</Alert>}
      <Controller
        name="email"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            id="login-email"
            autoComplete="username"
            autoFocus
            error={Boolean(errors.email)}
            helperText={errors.email?.message}
            label="E-mail"
            placeholder="nome@empresa.com.br"
            type="email"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <MailOutlineIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              },
            }}
          />
        )}
      />
      <Controller
        name="password"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            autoComplete="current-password"
            error={Boolean(errors.password)}
            helperText={errors.password?.message}
            label="Senha"
            type={showPassword ? 'text' : 'password'}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      onClick={() => setShowPassword((value) => !value)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? (
                        <VisibilityOffOutlinedIcon fontSize="small" />
                      ) : (
                        <VisibilityOutlinedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        )}
      />
      <Button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        size="large"
        endIcon={!isSubmitting && <ArrowForwardIcon />}
        sx={{ height: 52 }}
      >
        {isSubmitting ? 'Entrando…' : 'Entrar'}
      </Button>
    </Stack>
  );
}
