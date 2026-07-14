import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Card,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { USER_ROLES } from '../../api/contract';
import { ApiError } from '../../api/problem';
import { PageHeader } from '../../components/data-display/PageHeader';
import { roleLabel } from '../../lib/roles/roles';
import { usersApi } from './api';
import { createUserSchema, type CreateUserForm } from './schemas';

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

export function NewUserPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createUser = useMutation({ mutationFn: usersApi.create });
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { email: '', password: '', confirmPassword: '', role: 'VIEWER' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createUser.mutateAsync({
        email: values.email.trim().toLowerCase(),
        password: values.password,
        role: values.role,
      });
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      void navigate('/users', { replace: true });
    } catch {
      // A mutação mantém o problema disponível para a mensagem persistente abaixo.
    }
  });
  const apiMessage = createUser.error instanceof ApiError ? createUser.error.problem.detail : null;

  return (
    <>
      <PageHeader title="Novo usuário" description="Conceda acesso ao Tenancy Ledger." />
      <Card sx={{ maxWidth: 960, p: { xs: 2, sm: 3.5 } }}>
        <Stack component="form" spacing={3} onSubmit={onSubmit} noValidate>
          {apiMessage && <Alert severity="error">{apiMessage}</Alert>}
          <Box>
            <SectionLabel>Acesso</SectionLabel>
            <Box sx={fieldGridSx}>
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="E-mail"
                    type="email"
                    autoComplete="email"
                    error={Boolean(errors.email)}
                    helperText={errors.email?.message}
                  />
                )}
              />
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    label="Papel"
                    error={Boolean(errors.role)}
                    helperText={errors.role?.message}
                  >
                    {USER_ROLES.map((role) => (
                      <MenuItem key={role} value={role}>
                        {roleLabel(role)}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Box>
          </Box>
          <Divider />
          <Box>
            <SectionLabel>Senha temporária</SectionLabel>
            <Box sx={fieldGridSx}>
              <Controller
                name="password"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Senha temporária"
                    type="password"
                    autoComplete="new-password"
                    error={Boolean(errors.password)}
                    helperText={
                      errors.password?.message ??
                      'Mínimo de 12 caracteres, com maiúscula, minúscula, número e símbolo.'
                    }
                  />
                )}
              />
              <Controller
                name="confirmPassword"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Confirmar senha"
                    type="password"
                    autoComplete="new-password"
                    error={Boolean(errors.confirmPassword)}
                    helperText={errors.confirmPassword?.message}
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
              onClick={() => void navigate('/users')}
              disabled={createUser.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createUser.isPending} aria-busy={createUser.isPending}>
              {createUser.isPending ? 'Criando…' : 'Criar usuário'}
            </Button>
          </Stack>
        </Stack>
      </Card>
    </>
  );
}
