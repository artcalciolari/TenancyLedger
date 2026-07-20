import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiProblem } from '../../api/problem';
import { SettleCashDialog } from './SettleCashDialog';

const { settleCash, receiptDownload } = vi.hoisted(() => ({
  settleCash: vi.fn(),
  receiptDownload: vi.fn(),
}));

vi.mock('./api', () => ({ invoicesApi: { settleCash } }));
vi.mock('../receipts/api', () => ({ receiptsApi: { download: receiptDownload } }));

const invoice = {
  id: '50000000-0000-4000-8000-000000000001',
  contractId: '40000000-0000-4000-8000-000000000001',
  outstandingAmountCents: 150_000,
};

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: '*', element: <SettleCashDialog invoice={invoice} open onClose={vi.fn()} /> }],
    { initialEntries: ['/contracts/contract-id'] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function conflictError(detail = 'O caixa deste dia está fechado.'): ApiError {
  const problem: ApiProblem = {
    type: 'about:blank',
    title: 'Conflict',
    status: 409,
    detail,
    instance: '',
    requestId: null,
    timestamp: '2026-07-18T12:00:00.000Z',
  };
  return new ApiError(problem);
}

describe('SettleCashDialog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    settleCash.mockReset();
    receiptDownload.mockReset();
    vi.spyOn(window, 'open').mockReturnValue(null);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('idem-00000000-0000-4000-8000-00000001');
  });

  it('aprova o dinheiro e abre o recibo sequencial', async () => {
    const popup = { location: { href: '' }, close: vi.fn() };
    vi.mocked(window.open).mockReturnValue(popup as unknown as Window);
    settleCash.mockResolvedValue({
      invoice: { ...invoice, payments: [] },
      receiptId: 'receipt-id',
    });
    receiptDownload.mockResolvedValue({
      url: 'https://storage.test/receipt.pdf',
      expiresInSeconds: 300,
    });
    renderDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Confirmar recebimento' }));

    await waitFor(() => expect(settleCash).toHaveBeenCalledOnce());
    expect(settleCash).toHaveBeenCalledWith(
      invoice.id,
      150_000,
      'idem-00000000-0000-4000-8000-00000001',
    );
    expect(receiptDownload).toHaveBeenCalledWith('receipt-id');
    expect(await screen.findByText('Pagamento registrado e recibo emitido.')).toBeVisible();
    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(popup.location.href).toBe('https://storage.test/receipt.pdf');
  });

  it('oferece a reabertura do caixa quando o settlement retorna 409', async () => {
    settleCash.mockRejectedValue(conflictError());
    renderDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Confirmar recebimento' }));

    expect(await screen.findByText('O caixa deste dia está fechado.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Abrir caixa' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/cashbox\?date=\d{4}-\d{2}-\d{2}$/),
    );
  });

  it('não oferece reabertura para outros conflitos do settlement', async () => {
    settleCash.mockRejectedValue(conflictError('O valor ultrapassa o saldo em aberto.'));
    renderDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Confirmar recebimento' }));

    expect(await screen.findByText('O valor ultrapassa o saldo em aberto.')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Abrir caixa' })).not.toBeInTheDocument();
  });

  it('reutiliza a chave de idempotência ao tentar novamente após uma falha', async () => {
    settleCash.mockRejectedValueOnce(new Error('Tempo limite')).mockResolvedValueOnce({
      invoice: { ...invoice, payments: [] },
      receiptId: 'receipt-id',
    });
    receiptDownload.mockResolvedValue({
      url: 'https://storage.test/receipt.pdf',
      expiresInSeconds: 300,
    });
    renderDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Confirmar recebimento' }));
    expect(await screen.findByText('Tempo limite')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Confirmar recebimento' }));

    await waitFor(() => expect(settleCash).toHaveBeenCalledTimes(2));
    expect(settleCash.mock.calls[0]?.[2]).toBe('idem-00000000-0000-4000-8000-00000001');
    expect(settleCash.mock.calls[1]?.[2]).toBe(settleCash.mock.calls[0]?.[2]);
  });

  it('mantém o pagamento como sucesso e tenta novamente apenas o recibo', async () => {
    settleCash.mockResolvedValue({
      invoice: { ...invoice, payments: [] },
      receiptId: 'receipt-id',
    });
    receiptDownload.mockRejectedValueOnce(new Error('Storage indisponível')).mockResolvedValueOnce({
      url: 'https://storage.test/receipt.pdf',
      expiresInSeconds: 300,
    });
    renderDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Confirmar recebimento' }));

    expect(await screen.findByText('Pagamento registrado e recibo emitido.')).toBeVisible();
    expect(await screen.findByText('Não foi possível abrir o recibo agora.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Tentar abrir recibo' }));

    await waitFor(() => expect(receiptDownload).toHaveBeenCalledTimes(2));
    expect(settleCash).toHaveBeenCalledOnce();
    expect(await screen.findByRole('link', { name: 'Abrir recibo novamente' })).toBeVisible();
  });
});
