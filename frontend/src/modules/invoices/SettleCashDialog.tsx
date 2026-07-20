import LocalAtmOutlinedIcon from '@mui/icons-material/LocalAtmOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import type { InvoiceView } from '../../api/contract';
import { queryKeys } from '../../api/query-keys';
import { ApiError } from '../../api/problem';
import { formatCents, parseBrlToCents } from '../../lib/money/money';
import { receiptsApi } from '../receipts/api';
import { invoicesApi } from './api';

interface SettleCashDialogProps {
  invoice: Pick<InvoiceView, 'id' | 'contractId' | 'outstandingAmountCents'>;
  open: boolean;
  onClose: () => void;
  onSettled?: (invoice: InvoiceView) => void;
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

export function SettleCashDialog({ invoice, open, onClose, onSettled }: SettleCashDialogProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(() =>
    (invoice.outstandingAmountCents / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  );
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [settlementComplete, setSettlementComplete] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const receiptPopup = useRef<Window | null>(null);
  const idempotencyKey = useRef<string | null>(null);
  const downloadReceipt = useMutation({
    mutationFn: (id: string) => receiptsApi.download(id),
    onSuccess: (download) => {
      setReceiptError(null);
      setReceiptUrl(download.url);
      if (receiptPopup.current) {
        receiptPopup.current.location.href = download.url;
      } else {
        window.open(download.url, '_blank', 'noopener,noreferrer');
      }
      receiptPopup.current = null;
    },
    onError: (failure) => {
      receiptPopup.current?.close();
      receiptPopup.current = null;
      setReceiptError(
        failure instanceof ApiError
          ? failure.problem.detail
          : 'Não foi possível abrir o recibo agora.',
      );
    },
  });
  const settle = useMutation({
    mutationFn: async (amountCents: number) => {
      const key = idempotencyKey.current ?? crypto.randomUUID();
      idempotencyKey.current = key;
      return invoicesApi.settleCash(invoice.id, amountCents, key);
    },
    onSuccess: (result) => {
      setError(null);
      setSettlementComplete(true);
      setReceiptId(result.receiptId);
      idempotencyKey.current = null;
      queryClient.setQueryData(queryKeys.invoice(invoice.id), result.invoice);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.contract(invoice.contractId) }),
        queryClient.invalidateQueries({ queryKey: ['contracts'] }),
        queryClient.invalidateQueries({ queryKey: ['invoices'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      ]);
      onSettled?.(result.invoice);
      if (result.receiptId) {
        downloadReceipt.mutate(result.receiptId);
      } else {
        receiptPopup.current?.close();
        receiptPopup.current = null;
        setReceiptError('O pagamento foi registrado, mas o recibo não pôde ser localizado.');
      }
    },
    onError: (failure) => {
      receiptPopup.current?.close();
      receiptPopup.current = null;
      setError(failure instanceof Error ? failure : new Error('Falha'));
    },
  });

  const submit = () => {
    const cents = parseBrlToCents(amount);
    if (cents === null || cents < 1) {
      setError(new Error('Informe um valor maior que zero.'));
      return;
    }
    if (cents > invoice.outstandingAmountCents) {
      setError(
        new Error(`O valor não pode ultrapassar ${formatCents(invoice.outstandingAmountCents)}.`),
      );
      return;
    }
    setError(null);
    receiptPopup.current?.close();
    receiptPopup.current = window.open('', '_blank');
    settle.mutate(cents);
  };

  const retryReceipt = () => {
    if (!receiptId) return;
    setReceiptError(null);
    receiptPopup.current?.close();
    receiptPopup.current = window.open('', '_blank');
    downloadReceipt.mutate(receiptId);
  };

  const closeDialog = () => {
    receiptPopup.current?.close();
    receiptPopup.current = null;
    idempotencyKey.current = null;
    onClose();
  };

  const cashboxConflict =
    error instanceof ApiError &&
    error.status === 409 &&
    error.problem.detail.toLocaleLowerCase('pt-BR').includes('caixa') &&
    error.problem.detail.toLocaleLowerCase('pt-BR').includes('fechad');
  const errorMessage = error instanceof ApiError ? error.problem.detail : error?.message;
  const busy = settle.isPending || downloadReceipt.isPending;

  return (
    <Dialog open={open} onClose={busy ? undefined : closeDialog} fullWidth maxWidth="sm">
      <DialogTitle>Registrar pagamento em dinheiro</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">
            O pagamento será aprovado imediatamente e um recibo sequencial será emitido.
          </Alert>
          {errorMessage && (
            <Alert
              severity="error"
              action={
                cashboxConflict ? (
                  <Link
                    component={RouterLink}
                    to={`/cashbox?date=${todayIso()}`}
                    color="inherit"
                    sx={{ fontWeight: 700 }}
                  >
                    Abrir caixa
                  </Link>
                ) : undefined
              }
            >
              {errorMessage}
            </Alert>
          )}
          {settlementComplete && (
            <Alert severity="success">
              <Typography variant="body2" sx={{ mb: receiptUrl ? 1 : 0 }}>
                Pagamento registrado e recibo emitido.
              </Typography>
              {downloadReceipt.isPending && (
                <Typography variant="caption">Preparando a abertura do recibo…</Typography>
              )}
              {receiptUrl && (
                <Button
                  component="a"
                  href={receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  variant="outlined"
                  size="small"
                  startIcon={<OpenInNewOutlinedIcon />}
                >
                  Abrir recibo novamente
                </Button>
              )}
            </Alert>
          )}
          {receiptError && (
            <Alert
              severity="warning"
              action={
                receiptId ? (
                  <Button color="inherit" onClick={retryReceipt}>
                    Tentar abrir recibo
                  </Button>
                ) : undefined
              }
            >
              {receiptError}
            </Alert>
          )}
          <TextField
            label="Valor recebido"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            disabled={settle.isPending || settlementComplete}
            helperText={`Saldo em aberto: ${formatCents(invoice.outstandingAmountCents)}`}
            slotProps={{ input: { startAdornment: <Typography sx={{ mr: 1 }}>R$</Typography> } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={closeDialog} disabled={busy}>
          {settlementComplete ? 'Concluir' : 'Cancelar'}
        </Button>
        {!settlementComplete && (
          <Button startIcon={<LocalAtmOutlinedIcon />} onClick={submit} disabled={settle.isPending}>
            {settle.isPending ? 'Registrando…' : 'Confirmar recebimento'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
