import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import type { SubmitPaymentInput } from '../../api/contract';
import { ApiError } from '../../api/problem';
import { queryKeys } from '../../api/query-keys';
import { formatCents, parseBrlToCents } from '../../lib/money/money';
import { invoicesApi } from './api';
import { paymentMethodLabels, proofTypeLabels } from './labels';

const acceptedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const paymentSchema = z
  .object({
    amount: z.string().min(1, 'Informe o valor.'),
    method: z.enum(['PIX', 'CASH', 'BANK_TRANSFER']),
    proofType: z.enum(['DIGITAL_SLIP', 'SIGNED_RECEIPT', 'BANK_STATEMENT']).optional(),
    proof: z.custom<File>((value) => value instanceof File, 'Selecione um arquivo.').optional(),
  })
  .superRefine((value, context) => {
    const cents = parseBrlToCents(value.amount);
    if (cents === null || cents < 1) {
      context.addIssue({ code: 'custom', path: ['amount'], message: 'Informe um valor válido.' });
    }
    if (value.method !== 'CASH') {
      if (!value.proofType) {
        context.addIssue({ code: 'custom', path: ['proofType'], message: 'Selecione o tipo.' });
      }
      if (!value.proof) {
        context.addIssue({ code: 'custom', path: ['proof'], message: 'Selecione o comprovante.' });
      }
    }
    if (value.proof && !acceptedTypes.includes(value.proof.type)) {
      context.addIssue({ code: 'custom', path: ['proof'], message: 'Formato não aceito.' });
    }
    if (value.proof && (value.proof.size < 1 || value.proof.size > 10 * 1024 * 1024)) {
      context.addIssue({
        code: 'custom',
        path: ['proof'],
        message: 'O arquivo deve ter até 10 MiB.',
      });
    }
  });

type PaymentForm = z.infer<typeof paymentSchema>;

export function SubmitPaymentDialog({
  invoiceId,
  availableCents,
  open,
  onClose,
}: {
  invoiceId: string;
  availableCents: number;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [uncertain, setUncertain] = useState(false);
  const [verified, setVerified] = useState(false);
  const pendingRef = useRef<{ input: SubmitPaymentInput; key: string } | null>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const {
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: '', method: 'PIX', proofType: undefined, proof: undefined },
  });
  const method = watch('method');

  const mutation = useMutation({
    mutationFn: ({ input, key }: { input: SubmitPaymentInput; key: string }) =>
      invoicesApi.submit(invoiceId, input, key),
    retry: false,
    onSuccess: async () => {
      pendingRef.current = null;
      setUncertain(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.invoice(invoiceId) }),
        queryClient.invalidateQueries({ queryKey: ['invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['payments', 'review'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      ]);
      reset();
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 0) {
        setUncertain(true);
        return;
      }
      pendingRef.current = null;
      setError('root', {
        message: error instanceof ApiError ? error.problem.detail : 'Não foi possível enviar.',
      });
    },
  });
  const verification = useMutation({
    mutationFn: () => {
      const pending = pendingRef.current;
      if (!pending) throw new Error('Não há envio pendente para verificar.');
      return invoicesApi.lookupPayment(invoiceId, pending.key);
    },
    retry: false,
    onSuccess: async () => {
      pendingRef.current = null;
      setUncertain(false);
      setVerified(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.invoice(invoiceId) }),
        queryClient.invalidateQueries({ queryKey: ['invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['payments', 'review'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      ]);
    },
  });
  const resetVerification = verification.reset;

  useEffect(() => {
    if (!open) {
      reset();
      setUncertain(false);
      setVerified(false);
      pendingRef.current = null;
      resetVerification();
    }
  }, [open, reset, resetVerification]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => amountInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (method === 'CASH') {
      setValue('proof', undefined);
      setValue('proofType', undefined);
    }
  }, [method, setValue]);

  const submit = (values: PaymentForm) => {
    const amountCents = parseBrlToCents(values.amount);
    if (amountCents === null || amountCents > availableCents) {
      setError('amount', {
        message: `O valor não pode ultrapassar ${formatCents(availableCents)}.`,
      });
      return;
    }
    const input: SubmitPaymentInput = {
      amountCents,
      method: values.method,
      ...(values.method === 'CASH' ? {} : { proofType: values.proofType!, proof: values.proof }),
    };
    const request = { input, key: crypto.randomUUID() };
    pendingRef.current = request;
    setVerified(false);
    resetVerification();
    mutation.mutate(request);
  };

  const discardUnknown = () => {
    pendingRef.current = null;
    setUncertain(false);
    mutation.reset();
    resetVerification();
  };

  return (
    <Dialog
      open={open}
      onClose={mutation.isPending || uncertain ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>Registrar pagamento</DialogTitle>
      <DialogContent>
        <Stack
          component="form"
          id="payment-form"
          spacing={2.5}
          sx={{ pt: 1 }}
          onSubmit={handleSubmit(submit)}
        >
          <Alert severity="info">Saldo ainda submetível: {formatCents(availableCents)}</Alert>
          {errors.root?.message && <Alert severity="error">{errors.root.message}</Alert>}
          {uncertain && (
            <Alert severity="warning">
              O servidor pode ter recebido o pagamento. Verifique a fatura antes de iniciar outro
              envio.
            </Alert>
          )}
          {verified && (
            <Alert severity="success">
              O pagamento foi localizado pela chave de idempotência e a fatura foi atualizada.
            </Alert>
          )}
          {verification.isError && (
            <Alert
              severity={
                verification.error instanceof ApiError && verification.error.status === 404
                  ? 'info'
                  : 'error'
              }
            >
              {verification.error instanceof ApiError && verification.error.status === 404
                ? 'O pagamento ainda não foi localizado. Você pode tentar o mesmo envio novamente ou descartá-lo para editar.'
                : 'Não foi possível verificar o pagamento agora. Tente novamente.'}
            </Alert>
          )}
          <Controller
            name="amount"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                inputRef={amountInputRef}
                label="Valor"
                placeholder="0,00"
                inputMode="decimal"
                disabled={uncertain}
                error={Boolean(errors.amount)}
                helperText={errors.amount?.message}
              />
            )}
          />
          <Controller
            name="method"
            control={control}
            render={({ field }) => (
              <FormControl error={Boolean(errors.method)} disabled={uncertain}>
                <InputLabel id="payment-method-label">Método</InputLabel>
                <Select {...field} labelId="payment-method-label" label="Método">
                  {Object.entries(paymentMethodLabels).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>{errors.method?.message}</FormHelperText>
              </FormControl>
            )}
          />
          {method !== 'CASH' && (
            <>
              <Controller
                name="proofType"
                control={control}
                render={({ field }) => (
                  <FormControl error={Boolean(errors.proofType)} disabled={uncertain}>
                    <InputLabel id="proof-type-label">Tipo de comprovante</InputLabel>
                    <Select
                      {...field}
                      value={field.value ?? ''}
                      labelId="proof-type-label"
                      label="Tipo de comprovante"
                    >
                      {Object.entries(proofTypeLabels).map(([value, label]) => (
                        <MenuItem key={value} value={value}>
                          {label}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>{errors.proofType?.message}</FormHelperText>
                  </FormControl>
                )}
              />
              <Button component="label" variant="outlined" disabled={uncertain}>
                Selecionar comprovante
                <input
                  hidden
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    setValue('proof', event.target.files?.[0], { shouldValidate: true })
                  }
                />
              </Button>
              {watch('proof') && (
                <Typography variant="body2">Arquivo: {watch('proof')?.name}</Typography>
              )}
              {errors.proof?.message && (
                <FormHelperText error>{errors.proof.message}</FormHelperText>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap' }}>
        {verified ? (
          <Button onClick={onClose}>Concluir</Button>
        ) : uncertain ? (
          <>
            <Button onClick={() => verification.mutate()} disabled={verification.isPending}>
              {verification.isPending ? 'Verificando…' : 'Verificar fatura'}
            </Button>
            <Button variant="outlined" onClick={discardUnknown}>
              Descartar e editar
            </Button>
            <Button
              onClick={() => pendingRef.current && mutation.mutate(pendingRef.current)}
              disabled={mutation.isPending}
            >
              Tentar novamente
            </Button>
          </>
        ) : (
          <>
            <Button variant="text" onClick={onClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="payment-form"
              disabled={mutation.isPending || availableCents < 1}
            >
              {mutation.isPending ? 'Enviando…' : 'Enviar para revisão'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
