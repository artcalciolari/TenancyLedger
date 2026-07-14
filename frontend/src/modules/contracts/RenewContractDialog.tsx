import { zodResolver } from '@hookform/resolvers/zod';
import AutorenewOutlinedIcon from '@mui/icons-material/AutorenewOutlined';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import type { ContractView } from '../../api/contract';
import { brand } from '../../app/theme/theme';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { useRenewContract } from './hooks';
import { renewContractSchema, type RenewContractForm } from './schemas';

interface RenewContractDialogProps {
  contract: ContractView;
  open: boolean;
  onClose: () => void;
  onRenewed: (contract: ContractView) => void;
}

export function RenewContractDialog({
  contract,
  open,
  onClose,
  onRenewed,
}: RenewContractDialogProps) {
  const renew = useRenewContract(contract.id);
  const {
    handleSubmit,
    register,
    reset,
    setError,
    formState: { errors },
  } = useForm<RenewContractForm>({
    resolver: zodResolver(renewContractSchema),
    defaultValues: { extraMonths: Math.min(12, 600 - contract.durationInMonths) },
  });

  const close = () => {
    reset({ extraMonths: Math.min(12, 600 - contract.durationInMonths) });
    renew.reset();
    onClose();
  };

  const submit = handleSubmit(async ({ extraMonths }) => {
    if (extraMonths > 600 - contract.durationInMonths) {
      setError('extraMonths', {
        message: `A renovação pode acrescentar no máximo ${600 - contract.durationInMonths} meses.`,
      });
      return;
    }
    const renewed = await renew.mutateAsync(extraMonths);
    onRenewed(renewed);
    close();
  });

  return (
    <Dialog open={open} onClose={renew.isPending ? undefined : close} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Stack
          sx={{
            width: 34,
            height: 34,
            borderRadius: '10px',
            bgcolor: brand.accentTint,
            color: brand.accentDark,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <AutorenewOutlinedIcon sx={{ fontSize: 19 }} />
        </Stack>
        Renovar contrato
      </DialogTitle>
      <DialogContent dividers>
        <Stack component="form" id="renew-contract-form" spacing={2.5} onSubmit={submit} noValidate>
          <Typography color="text.secondary">
            Informe quantos meses serão acrescentados. A nova data final será confirmada pela API.
          </Typography>
          {renew.isError && <ProblemAlert error={renew.error} />}
          <TextField
            {...register('extraMonths', { valueAsNumber: true })}
            label="Meses adicionais"
            type="number"
            autoFocus
            error={Boolean(errors.extraMonths)}
            helperText={
              errors.extraMonths?.message ??
              `A vigência total não pode ultrapassar 600 meses; restam ${600 - contract.durationInMonths}.`
            }
            slotProps={{
              htmlInput: { min: 1, max: 600 - contract.durationInMonths, step: 1 },
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={close} disabled={renew.isPending}>
          Cancelar
        </Button>
        <Button
          type="submit"
          form="renew-contract-form"
          disabled={renew.isPending}
          aria-busy={renew.isPending}
        >
          {renew.isPending ? 'Renovando…' : 'Confirmar renovação'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
