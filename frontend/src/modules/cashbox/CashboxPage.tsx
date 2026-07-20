import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { ApiError } from '../../api/problem';
import { brand, statusTones } from '../../app/theme/theme';
import { PageHeader } from '../../components/data-display/PageHeader';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { EmptyState, LoadingState } from '../../components/feedback/QueryState';
import { formatCivilDate, formatDateTime } from '../../lib/dates/dates';
import { formatCents, parseBrlToCents } from '../../lib/money/money';
import { useAuth } from '../auth/useAuth';
import { cashboxApi } from './api';
import type { CashClosingView } from './types';

function localDateIso(value = new Date()): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isCivilDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 0) - 1, day ?? 0));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === (month ?? 0) - 1 &&
    date.getUTCDate() === day
  );
}

function daysBefore(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T12:00:00`);
  date.setDate(date.getDate() - days);
  return localDateIso(date);
}

function Difference({ value }: { value: number }) {
  const tone = value === 0 ? statusTones.success.fg : brand.razao;
  return (
    <Typography sx={{ color: tone, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
      {value > 0 ? '+' : ''}
      {formatCents(value)}
    </Typography>
  );
}

function ReopenDialog({ closing, onClose }: { closing: CashClosingView; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const reopen = useMutation({
    mutationFn: () => cashboxApi.reopen(closing.closingDate, reason.trim()),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['cash-closing', closing.closingDate] }),
        queryClient.invalidateQueries({ queryKey: ['cash-closings'] }),
      ]);
      onClose();
    },
    onError: (failure) =>
      setError(failure instanceof ApiError ? failure.problem.detail : 'Não foi possível reabrir.'),
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Reabrir caixa de {formatCivilDate(closing.closingDate)}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="warning">
            Novos pagamentos e estornos em dinheiro voltarão a ser permitidos para este dia.
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Motivo"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            multiline
            minRows={3}
            required
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          color="warning"
          disabled={!reason.trim() || reopen.isPending}
          onClick={() => reopen.mutate()}
        >
          {reopen.isPending ? 'Reabrindo…' : 'Confirmar reabertura'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function CashboxPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const today = useMemo(() => localDateIso(), []);
  const selectedDate = isCivilDate(searchParams.get('date')) ? searchParams.get('date')! : today;
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [counted, setCounted] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [reopenTarget, setReopenTarget] = useState<CashClosingView | null>(null);
  const current = useQuery({
    queryKey: ['cash-closing', selectedDate],
    queryFn: () => cashboxApi.get(selectedDate),
  });
  const history = useQuery({
    queryKey: ['cash-closings', { from: daysBefore(today, 30), to: today }],
    queryFn: () => cashboxApi.list({ from: daysBefore(today, 30), to: today }),
  });
  const close = useMutation({
    mutationFn: (countedCashCents: number) => cashboxApi.close(selectedDate, countedCashCents),
    onSuccess: async (closing) => {
      setCounted('');
      setFormError(null);
      queryClient.setQueryData(['cash-closing', selectedDate], closing);
      await queryClient.invalidateQueries({ queryKey: ['cash-closings'] });
    },
    onError: (failure) =>
      setFormError(
        failure instanceof ApiError
          ? failure.problem.detail
          : 'Não foi possível fechar o caixa agora.',
      ),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cents = parseBrlToCents(counted);
    if (cents === null) {
      setFormError('Informe o valor contado em reais.');
      return;
    }
    close.mutate(cents);
  };

  const closing = current.data;
  const canReopen = session?.user.role === 'ADMIN';
  const closeForm = (
    <Stack component="form" spacing={2} onSubmit={submit} noValidate>
      {closing?.status === 'REOPENED' && (
        <Alert severity="warning">
          O caixa foi reaberto. Faça uma nova contagem para fechá-lo novamente.
        </Alert>
      )}
      <Alert severity="info">
        O valor esperado será calculado pelo servidor ao confirmar o fechamento.
      </Alert>
      {formError && <Alert severity="error">{formError}</Alert>}
      <TextField
        label="Dinheiro contado"
        value={counted}
        onChange={(event) => setCounted(event.target.value)}
        inputMode="decimal"
        placeholder="0,00"
        slotProps={{
          input: { startAdornment: <Typography sx={{ mr: 1 }}>R$</Typography> },
        }}
        sx={{ maxWidth: 360 }}
      />
      <Button
        type="submit"
        startIcon={<AccountBalanceWalletOutlinedIcon />}
        disabled={close.isPending}
        sx={{ alignSelf: 'flex-start' }}
      >
        {close.isPending
          ? 'Fechando…'
          : closing?.status === 'REOPENED'
            ? 'Fechar caixa novamente'
            : 'Fechar caixa'}
      </Button>
    </Stack>
  );

  return (
    <>
      <PageHeader
        title="Fechamento de caixa"
        description="Confira o dinheiro recebido e registre a contagem física do dia."
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(320px, 0.72fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Stack spacing={2}>
          <Card>
            <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ alignItems: { sm: 'center' }, mb: 3 }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography component="h2" variant="h2">
                    Caixa do dia
                  </Typography>
                  <Typography color="text.secondary">
                    Pagamentos CASH aprovados em America/Sao_Paulo.
                  </Typography>
                </Box>
                <TextField
                  label="Data"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSearchParams({ date: event.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ maxWidth: 200 }}
                />
              </Stack>

              {current.isPending ? (
                <LoadingState label="Consultando caixa…" />
              ) : current.isError ? (
                <ProblemAlert error={current.error} onRetry={() => void current.refetch()} />
              ) : closing ? (
                <>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
                    <Chip
                      label={closing.status === 'CLOSED' ? 'Fechado' : 'Reaberto'}
                      color={closing.status === 'CLOSED' ? 'success' : 'warning'}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {closing.status === 'CLOSED'
                        ? `Fechado em ${formatDateTime(closing.closedAt)}`
                        : `Reaberto em ${formatDateTime(closing.reopenedAt)}`}
                    </Typography>
                  </Stack>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                      border: `1px solid ${brand.borderCard}`,
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    {[
                      ['Esperado', formatCents(closing.expectedCashCents)],
                      ['Contado', formatCents(closing.countedCashCents)],
                    ].map(([label, value]) => (
                      <Box
                        key={label}
                        sx={{ p: 2.5, borderRight: { sm: `1px solid ${brand.borderCard}` } }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {label}
                        </Typography>
                        <Typography sx={{ mt: 0.5, fontSize: '1.5rem', fontWeight: 650 }}>
                          {value}
                        </Typography>
                      </Box>
                    ))}
                    <Box sx={{ p: 2.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Diferença
                      </Typography>
                      <Box sx={{ mt: 0.5, fontSize: '1.5rem' }}>
                        <Difference value={closing.differenceCents} />
                      </Box>
                    </Box>
                  </Box>
                  {closing.reopenReason && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      Motivo da reabertura: {closing.reopenReason}
                    </Alert>
                  )}
                  {closing.status === 'CLOSED' && canReopen && (
                    <Button
                      variant="outlined"
                      color="warning"
                      startIcon={<LockOpenOutlinedIcon />}
                      onClick={() => setReopenTarget(closing)}
                      sx={{ mt: 2 }}
                    >
                      Reabrir caixa
                    </Button>
                  )}
                  {closing.status === 'REOPENED' && (
                    <>
                      <Divider sx={{ my: 2.5 }} />
                      {closeForm}
                    </>
                  )}
                </>
              ) : (
                closeForm
              )}
            </CardContent>
          </Card>
        </Stack>

        <Card>
          <CardContent sx={{ pb: 1 }}>
            <Typography component="h2" variant="h2">
              Últimos 30 dias
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Selecione uma data para consultar ou reabrir.
            </Typography>
          </CardContent>
          <Divider />
          {history.isPending ? (
            <LoadingState label="Carregando histórico…" />
          ) : history.isError ? (
            <Box sx={{ p: 2 }}>
              <ProblemAlert error={history.error} onRetry={() => void history.refetch()} />
            </Box>
          ) : history.data.length === 0 ? (
            <EmptyState title="Nenhum fechamento registrado" />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Data</TableCell>
                    <TableCell align="right">Diferença</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.data.map((item) => (
                    <TableRow
                      hover
                      key={item.id}
                      selected={item.closingDate === selectedDate}
                      onClick={() => setSearchParams({ date: item.closingDate })}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>{formatCivilDate(item.closingDate)}</TableCell>
                      <TableCell align="right">
                        <Difference value={item.differenceCents} />
                      </TableCell>
                      <TableCell>{item.status === 'CLOSED' ? 'Fechado' : 'Reaberto'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>
      </Box>
      {reopenTarget && (
        <ReopenDialog closing={reopenTarget} onClose={() => setReopenTarget(null)} />
      )}
    </>
  );
}
