import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubmitPaymentInput } from '../../api/contract';
import { ApiError, type ApiProblem } from '../../api/problem';
import { SubmitPaymentDialog } from './SubmitPaymentDialog';

const { lookupPayment, submitPayment } = vi.hoisted(() => ({
  lookupPayment: vi.fn(),
  submitPayment: vi.fn(),
}));

vi.mock('./api', () => ({
  invoicesApi: {
    lookupPayment,
    submit: submitPayment,
  },
}));

const invoiceId = '50000000-0000-4000-8000-000000000001';
const idempotencyKey = '60000000-0000-4000-8000-000000000001';

function apiError(status: number): ApiError {
  const problem: ApiProblem = {
    type: 'about:blank',
    title: status === 0 ? 'NetworkError' : 'RequestError',
    status,
    detail: status === 404 ? 'Pagamento não encontrado.' : 'Falha de rede.',
    instance: '',
    requestId: null,
    timestamp: '2026-07-13T00:00:00.000Z',
  };
  return new ApiError(problem);
}

function renderDialog() {
  const onClose = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <SubmitPaymentDialog invoiceId={invoiceId} availableCents={100_000} open onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}

async function submitPixPayment() {
  const user = userEvent.setup();
  const proof = new File(['proof-content'], 'comprovante.pdf', { type: 'application/pdf' });
  await user.type(screen.getByRole('textbox', { name: 'Valor' }), '500,00');
  await user.click(screen.getByRole('combobox', { name: 'Tipo de comprovante' }));
  await user.click(await screen.findByRole('option', { name: 'Comprovante digital' }));
  const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
  expect(fileInput).not.toBeNull();
  fireEvent.change(fileInput!, { target: { files: [proof] } });
  await user.click(screen.getByRole('button', { name: 'Enviar para revisão' }));
  return { proof, user };
}

async function reachUncertainState() {
  submitPayment.mockRejectedValueOnce(apiError(0));
  const result = await submitPixPayment();
  expect(await screen.findByText(/O servidor pode ter recebido o pagamento/)).toBeVisible();
  return result;
}

describe('SubmitPaymentDialog', () => {
  beforeEach(() => {
    lookupPayment.mockReset();
    submitPayment.mockReset();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(idempotencyKey);
  });

  it('envia pagamento em dinheiro sem campos de comprovante', async () => {
    const { onClose } = renderDialog();
    submitPayment.mockResolvedValueOnce({});
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: 'Valor' }), '125,00');
    await user.click(screen.getByRole('combobox', { name: 'Método' }));
    await user.click(await screen.findByRole('option', { name: 'Dinheiro' }));
    expect(screen.queryByRole('button', { name: 'Selecionar comprovante' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Enviar para revisão' }));

    await waitFor(() => expect(submitPayment).toHaveBeenCalledOnce());
    expect(submitPayment.mock.calls[0]?.[1]).toEqual({ amountCents: 12_500, method: 'CASH' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('mantém o diálogo aberto quando o valor supera o saldo submetível', async () => {
    const { onClose } = renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: 'Valor' }), '1.500,00');
    await user.click(screen.getByRole('combobox', { name: 'Método' }));
    await user.click(await screen.findByRole('option', { name: 'Dinheiro' }));
    await user.click(screen.getByRole('button', { name: 'Enviar para revisão' }));

    expect(await screen.findByText(/não pode ultrapassar R\$ 1\.000,00/)).toBeVisible();
    expect(submitPayment).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([
    [apiError(422), 'Falha de rede.'],
    [new Error('unexpected'), 'Não foi possível enviar.'],
  ])('exibe a falha definitiva de envio sem entrar no estado incerto', async (error, message) => {
    renderDialog();
    submitPayment.mockRejectedValueOnce(error);

    await submitPixPayment();

    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.queryByText(/O servidor pode ter recebido o pagamento/)).not.toBeInTheDocument();
  });

  it('bloqueia a edição após falha de rede e repete exatamente a mesma chave, payload e File', async () => {
    const { onClose } = renderDialog();
    submitPayment.mockRejectedValueOnce(apiError(0)).mockResolvedValueOnce({});

    const { proof, user } = await submitPixPayment();
    expect(await screen.findByText(/O servidor pode ter recebido o pagamento/)).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Valor' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Método' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Selecionar comprovante' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    const firstInput = submitPayment.mock.calls[0]?.[1] as SubmitPaymentInput;
    expect(firstInput).toMatchObject({
      amountCents: 50_000,
      method: 'PIX',
      proofType: 'DIGITAL_SLIP',
      proof,
    });
    expect(submitPayment.mock.calls[0]?.[2]).toBe(idempotencyKey);

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(submitPayment).toHaveBeenCalledTimes(2));
    const retriedInput = submitPayment.mock.calls[1]?.[1] as SubmitPaymentInput;
    expect(submitPayment.mock.calls[1]?.[0]).toBe(invoiceId);
    expect(retriedInput).toBe(firstInput);
    expect(retriedInput.proof).toBe(proof);
    expect(submitPayment.mock.calls[1]?.[2]).toBe(idempotencyKey);
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('mantém o envio bloqueado quando a consulta pela chave retorna 404', async () => {
    renderDialog();
    const { user } = await reachUncertainState();
    lookupPayment.mockRejectedValueOnce(apiError(404));

    await user.click(screen.getByRole('button', { name: 'Verificar fatura' }));

    expect(await screen.findByText(/O pagamento ainda não foi localizado/)).toBeVisible();
    expect(lookupPayment).toHaveBeenCalledWith(invoiceId, idempotencyKey);
    expect(screen.getByRole('textbox', { name: 'Valor' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  });

  it('mantém o envio bloqueado quando a consulta falha sem uma resposta conclusiva', async () => {
    renderDialog();
    const { user } = await reachUncertainState();
    lookupPayment.mockRejectedValueOnce(apiError(500));

    await user.click(screen.getByRole('button', { name: 'Verificar fatura' }));

    expect(await screen.findByText(/Não foi possível verificar o pagamento agora/)).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Valor' })).toBeDisabled();
  });

  it('conclui a verificação quando o lookup localiza o pagamento pela mesma chave', async () => {
    const { onClose } = renderDialog();
    const { user } = await reachUncertainState();
    lookupPayment.mockResolvedValueOnce({});

    await user.click(screen.getByRole('button', { name: 'Verificar fatura' }));

    expect(
      await screen.findByText(/O pagamento foi localizado pela chave de idempotência/),
    ).toBeVisible();
    expect(lookupPayment).toHaveBeenCalledWith(invoiceId, idempotencyKey);
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Concluir' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
