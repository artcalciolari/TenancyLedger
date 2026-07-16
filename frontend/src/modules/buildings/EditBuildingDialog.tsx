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
import type { BuildingDetailView, UpdateBuildingInput } from '../../api/contract';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { updateBuildingSchema, type UpdateBuildingForm } from './schemas';

interface EditBuildingDialogProps {
  building: BuildingDetailView;
  open: boolean;
  isPending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (input: UpdateBuildingInput) => Promise<void>;
}

export function EditBuildingDialog({
  building,
  open,
  isPending,
  error,
  onClose,
  onSubmit,
}: EditBuildingDialogProps) {
  const {
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = useForm<UpdateBuildingForm>({
    resolver: zodResolver(updateBuildingSchema),
    defaultValues: {
      name: building.name,
      neighborhood: building.neighborhood,
      address: building.address ?? '',
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: building.name,
        neighborhood: building.neighborhood,
        address: building.address ?? '',
      });
    }
  }, [building, open, reset]);

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
      <DialogTitle>Editar prédio</DialogTitle>
      <DialogContent dividers>
        <Stack component="form" id="edit-building-form" spacing={2.25} onSubmit={submit} noValidate>
          {error ? <ProblemAlert error={error} /> : null}
          <TextField
            {...register('name')}
            label="Nome do prédio"
            autoFocus
            error={Boolean(errors.name)}
            helperText={errors.name?.message}
          />
          <TextField
            {...register('neighborhood')}
            label="Bairro"
            error={Boolean(errors.neighborhood)}
            helperText={
              errors.neighborhood?.message ??
              'Ao salvar, o bairro também será atualizado nas unidades vinculadas.'
            }
          />
          <TextField
            {...register('address')}
            label="Endereço"
            error={Boolean(errors.address)}
            helperText={errors.address?.message}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" form="edit-building-form" disabled={isPending} aria-busy={isPending}>
          {isPending ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
