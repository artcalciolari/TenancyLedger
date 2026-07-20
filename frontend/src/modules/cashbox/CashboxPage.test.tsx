import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CashboxPage } from './CashboxPage';

const { closeCashbox, getCashbox, listCashboxes, reopenCashbox } = vi.hoisted(() => ({
  closeCashbox: vi.fn(),
  getCashbox: vi.fn(),
  listCashboxes: vi.fn(),
  reopenCashbox: vi.fn(),
}));

vi.mock('./api', () => ({
  cashboxApi: {
    close: closeCashbox,
    get: getCashbox,
    list: listCashboxes,
    reopen: reopenCashbox,
  },
}));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    session: {
      accessToken: 'token',
      user: { id: 'user-id', email: 'admin@test', role: 'ADMIN', active: true },
    },
  }),
}));

const closing = {
  id: 'closing-id',
  closingDate: '2026-07-18',
  expectedCashCents: 100_000,
  countedCashCents: 98_000,
  differenceCents: -2_000,
  status: 'CLOSED' as const,
  closedBy: 'user-id',
  closedAt: '2026-07-18T22:00:00.000Z',
  reopenReason: null,
  reopenedBy: null,
  reopenedAt: null,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter([{ path: '/cashbox', element: <CashboxPage /> }], {
    initialEntries: ['/cashbox?date=2026-07-18'],
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('CashboxPage', () => {
  beforeEach(() => {
    closeCashbox.mockReset();
    getCashbox.mockReset();
    listCashboxes.mockReset();
    reopenCashbox.mockReset();
    listCashboxes.mockResolvedValue([]);
  });

  it('mostra esperado, contado, diferença e reabre com motivo', async () => {
    getCashbox.mockResolvedValue(closing);
    listCashboxes.mockResolvedValue([closing]);
    reopenCashbox.mockResolvedValue({
      ...closing,
      status: 'REOPENED',
      reopenReason: 'Correção necessária',
    });
    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByText('R$ 1.000,00')).toBeVisible();
    expect(screen.getByText('R$ 980,00')).toBeVisible();
    expect(screen.getAllByText('-R$ 20,00').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Reabrir caixa' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: /Motivo/ }), 'Correção necessária');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar reabertura' }));

    await waitFor(() =>
      expect(reopenCashbox).toHaveBeenCalledWith('2026-07-18', 'Correção necessária'),
    );
  });

  it('fecha um dia aberto enviando a contagem em centavos', async () => {
    getCashbox.mockResolvedValue(null);
    closeCashbox.mockResolvedValue(closing);
    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByText(/O valor esperado será calculado pelo servidor/)).toBeVisible();
    await user.type(screen.getByLabelText('Dinheiro contado'), '980,00');
    await user.click(screen.getByRole('button', { name: 'Fechar caixa' }));

    await waitFor(() => expect(closeCashbox).toHaveBeenCalledWith('2026-07-18', 98_000));
  });

  it('fecha novamente um caixa reaberto', async () => {
    getCashbox.mockResolvedValue({
      ...closing,
      status: 'REOPENED',
      reopenReason: 'Correção necessária',
      reopenedAt: '2026-07-18T22:15:00.000Z',
    });
    closeCashbox.mockResolvedValue({ ...closing, countedCashCents: 100_000, differenceCents: 0 });
    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByText(/Faça uma nova contagem/)).toBeVisible();
    await user.type(screen.getByLabelText('Dinheiro contado'), '1.000,00');
    await user.click(screen.getByRole('button', { name: 'Fechar caixa novamente' }));

    await waitFor(() => expect(closeCashbox).toHaveBeenCalledWith('2026-07-18', 100_000));
  });
});
