import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { RoomView, UpdateRoomInput } from '../../api/contract';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { updateRoomSchema, type UpdateRoomForm } from './schemas';

interface EditRoomDialogProps {
  room: RoomView;
  open: boolean;
  isPending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (input: UpdateRoomInput) => Promise<void>;
}

export function EditRoomDialog({
  room,
  open,
  isPending,
  error,
  onClose,
  onSubmit,
}: EditRoomDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateRoomForm>({
    resolver: zodResolver(updateRoomSchema),
    defaultValues: { number: room.number },
  });

  useEffect(() => {
    if (open) reset({ number: room.number });
  }, [open, room, reset]);

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
      <DialogTitle>Editar quarto</DialogTitle>
      <DialogContent dividers>
        <Stack component="form" id="edit-room-form" spacing={2.25} onSubmit={submit} noValidate>
          {error ? <ProblemAlert error={error} /> : null}
          <TextField
            {...register('number')}
            label="Número do quarto"
            autoFocus
            error={Boolean(errors.number)}
            helperText={errors.number?.message}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" form="edit-room-form" disabled={isPending} aria-busy={isPending}>
          {isPending ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
