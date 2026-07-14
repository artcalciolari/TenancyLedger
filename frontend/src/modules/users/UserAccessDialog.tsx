import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { USER_ROLES, type UpdateUserAccessInput, type UserView } from '../../api/contract';
import { ApiError } from '../../api/problem';
import { roleLabel } from '../../lib/roles/roles';
import { updateUserAccessSchema, type UpdateUserAccessForm } from './schemas';

interface UserAccessDialogProps {
  currentUserId?: string;
  error: unknown;
  loading: boolean;
  onClose: () => void;
  onSubmit: (input: UpdateUserAccessInput) => Promise<void>;
  user: UserView | null;
}

export function UserAccessDialog({
  currentUserId,
  error,
  loading,
  onClose,
  onSubmit,
  user,
}: UserAccessDialogProps) {
  const { control, handleSubmit, reset } = useForm<UpdateUserAccessForm>({
    resolver: zodResolver(updateUserAccessSchema),
    defaultValues: { role: 'VIEWER', active: true },
  });

  useEffect(() => {
    if (user) reset({ role: user.role, active: user.active });
  }, [reset, user]);

  const submit = handleSubmit(async (values) => onSubmit(values));
  const message = error instanceof ApiError ? error.problem.detail : null;

  return (
    <Dialog open={Boolean(user)} onClose={loading ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Alterar acesso</DialogTitle>
      <DialogContent>
        <Stack
          component="form"
          id="user-access-form"
          spacing={2.5}
          sx={{ pt: 1 }}
          onSubmit={submit}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.9rem',
                flexShrink: 0,
              }}
            >
              {user?.email.charAt(0).toUpperCase()}
            </Box>
            <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{user?.email}</Typography>
          </Stack>
          {user?.id === currentUserId && (
            <Alert severity="info">
              O backend impede que você desative ou remova o próprio acesso administrativo.
            </Alert>
          )}
          {message && <Alert severity="error">{message}</Alert>}
          <Controller
            name="role"
            control={control}
            render={({ field }) => (
              <TextField {...field} select label="Papel">
                {USER_ROLES.map((role) => (
                  <MenuItem key={role} value={role}>
                    {roleLabel(role)}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          <Controller
            name="active"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Switch
                    checked={field.value}
                    onChange={(_, checked) => field.onChange(checked)}
                  />
                }
                label="Usuário ativo"
              />
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" form="user-access-form" disabled={loading} aria-busy={loading}>
          {loading ? 'Salvando…' : 'Salvar acesso'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
