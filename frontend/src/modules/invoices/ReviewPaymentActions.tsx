import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { PaymentMethod } from '../../api/contract';
import { ApiError } from '../../api/problem';
import { queryKeys } from '../../api/query-keys';
import { formatCents } from '../../lib/money/money';
import { formatCompetence } from '../../lib/dates/dates';
import { invoicesApi } from './api';
import { paymentMethodLabels } from './labels';

type Action = 'approve' | 'reject' | null;

export function ReviewPaymentActions({
  invoiceId,
  paymentId,
  amountCents,
  method,
  competence,
}: {
  invoiceId: string;
  paymentId: string;
  amountCents: number;
  method: PaymentMethod;
  competence: string;
}) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState('');
  const mutation = useMutation({
    mutationFn: () =>
      action === 'approve'
        ? invoicesApi.approve(invoiceId, paymentId)
        : invoicesApi.reject(invoiceId, paymentId, { reason: reason.trim() }),
    retry: false,
    onSuccess: async () => {
      setAction(null);
      setReason('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.invoice(invoiceId) }),
        queryClient.invalidateQueries({ queryKey: ['invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['payments', 'review'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      ]);
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.status === 409) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.invoice(invoiceId) }),
          queryClient.invalidateQueries({ queryKey: ['payments', 'review'] }),
        ]);
      }
    },
  });

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.status === 409
        ? 'Este pagamento já foi revisado por outro operador. Os dados foram atualizados.'
        : mutation.error.problem.detail
      : mutation.isError
        ? 'Não foi possível revisar o pagamento.'
        : null;

  return (
    <>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button
          variant="outlined"
          color="error"
          onClick={() => {
            mutation.reset();
            setAction('reject');
          }}
        >
          Rejeitar
        </Button>
        <Button
          color="success"
          onClick={() => {
            mutation.reset();
            setAction('approve');
          }}
        >
          Aprovar
        </Button>
      </Stack>
      <Dialog
        open={action !== null}
        onClose={mutation.isPending ? undefined : () => setAction(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {action === 'approve' ? 'Aprovar pagamento' : 'Rejeitar pagamento'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: action === 'reject' ? 2 : 0 }}>
            {action === 'approve'
              ? `Confirma a aprovação de ${formatCents(amountCents)}, por ${paymentMethodLabels[method]}, na fatura ${formatCompetence(competence)}?`
              : `Informe o motivo da rejeição de ${formatCents(amountCents)}, por ${paymentMethodLabels[method]}, na fatura ${formatCompetence(competence)}.`}
          </DialogContentText>
          {action === 'reject' && (
            <TextField
              autoFocus
              multiline
              minRows={3}
              label="Motivo"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              error={reason.length > 500}
              helperText={`${reason.length}/500`}
            />
          )}
          {errorMessage && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errorMessage}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setAction(null)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            color={action === 'approve' ? 'success' : 'error'}
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending ||
              (action === 'reject' && (reason.trim().length < 1 || reason.length > 500))
            }
          >
            {mutation.isPending ? 'Salvando…' : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
