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
import { UNIT_TYPES, type PropertyView, type UpdatePropertyInput } from '../../api/contract';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { unitTypeLabel } from './labels';
import {
  updatePropertySchema,
  updateStandalonePropertySchema,
  type UpdatePropertyForm,
} from './schemas';

interface EditPropertyDialogProps {
  property: PropertyView;
  open: boolean;
  isPending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (input: UpdatePropertyInput) => Promise<void>;
}

export function EditPropertyDialog({
  property,
  open,
  isPending,
  error,
  onClose,
  onSubmit,
}: EditPropertyDialogProps) {
  const linkedToBuilding = Boolean(property.buildingId);
  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = useForm<UpdatePropertyForm>({
    resolver: zodResolver(linkedToBuilding ? updatePropertySchema : updateStandalonePropertySchema),
    defaultValues: {
      neighborhood: linkedToBuilding ? undefined : property.neighborhood,
      unitNumber: property.unitNumber,
      type: property.type,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        neighborhood: linkedToBuilding ? undefined : property.neighborhood,
        unitNumber: property.unitNumber,
        type: property.type,
      });
    }
  }, [linkedToBuilding, open, property, reset]);

  const submit = handleSubmit(async (values) => {
    const input = linkedToBuilding ? { unitNumber: values.unitNumber, type: values.type } : values;
    try {
      await onSubmit(input);
      onClose();
    } catch {
      // O erro da mutação é exibido pelo ProblemAlert.
    }
  });

  return (
    <Dialog open={open} onClose={isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Editar imóvel</DialogTitle>
      <DialogContent dividers>
        <Stack component="form" id="edit-property-form" spacing={2.25} onSubmit={submit} noValidate>
          {linkedToBuilding ? (
            <Alert severity="info">
              O vínculo com o prédio e o bairro derivado não podem ser alterados.
            </Alert>
          ) : null}
          {error ? <ProblemAlert error={error} /> : null}
          {linkedToBuilding ? (
            <TextField label="Bairro" value={property.neighborhood} disabled />
          ) : (
            <TextField
              {...register('neighborhood')}
              label="Bairro"
              autoFocus
              error={Boolean(errors.neighborhood)}
              helperText={errors.neighborhood?.message}
            />
          )}
          <TextField
            {...register('unitNumber')}
            label="Número da unidade"
            autoFocus={linkedToBuilding}
            error={Boolean(errors.unitNumber)}
            helperText={errors.unitNumber?.message}
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
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" form="edit-property-form" disabled={isPending} aria-busy={isPending}>
          {isPending ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
