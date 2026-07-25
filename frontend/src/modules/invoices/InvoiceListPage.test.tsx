import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvoiceListPage } from './InvoiceListPage';

const listInvoices = vi.hoisted(() => vi.fn());
const listContracts = vi.hoisted(() => vi.fn());
const getContract = vi.hoisted(() => vi.fn());

vi.mock('./api', () => ({ invoicesApi: { list: listInvoices } }));
vi.mock('../contracts/api', () => ({
  contractsApi: { list: listContracts, get: getContract },
}));

const contractId = '123e4567-e89b-42d3-a456-426614174000';

const contract = {
  id: contractId,
  room: { number: '101', buildingName: 'Edifício Aurora' },
  tenant: { name: 'Beatriz Souza', cpf: '***.***.***-09' },
};

function renderPage(initialEntry = '/invoices') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <InvoiceListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('InvoiceListPage', () => {
  beforeEach(() => {
    listInvoices.mockReset();
    listInvoices.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    listContracts.mockReset();
    listContracts.mockResolvedValue({
      data: [contract],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    getContract.mockReset();
    getContract.mockResolvedValue(contract);
  });

  it('aplica o filtro de contrato pela seleção assistida', { timeout: 15_000 }, async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(listInvoices).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Filtros avançados' }));
    await user.click(screen.getByRole('button', { name: 'Selecionar' }));

    const dialog = await screen.findByRole('dialog', { name: 'Selecionar contrato' });
    await user.click(await within(dialog).findByRole('button', { name: /Edifício Aurora/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar seleção' }));

    await waitFor(() =>
      expect(listInvoices).toHaveBeenLastCalledWith(
        expect.objectContaining({ contractId, page: 1 }),
      ),
    );
  });

  it('"Limpar" do contrato preserva os demais filtros', { timeout: 15_000 }, async () => {
    const user = userEvent.setup();
    renderPage(`/invoices?status=OVERDUE&contractId=${contractId}`);

    await waitFor(() =>
      expect(listInvoices).toHaveBeenLastCalledWith(
        expect.objectContaining({ contractId, status: 'OVERDUE' }),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Filtros avançados' }));
    await user.click(await screen.findByRole('button', { name: 'Limpar' }));

    await waitFor(() => {
      const lastCall = listInvoices.mock.lastCall?.[0] as Record<string, unknown>;
      expect(lastCall.contractId).toBeUndefined();
      expect(lastCall.status).toBe('OVERDUE');
    });
  });

  it('"Limpar filtros" remove todos os filtros de uma vez', { timeout: 15_000 }, async () => {
    const user = userEvent.setup();
    renderPage(`/invoices?status=OVERDUE&contractId=${contractId}`);

    await waitFor(() =>
      expect(listInvoices).toHaveBeenLastCalledWith(
        expect.objectContaining({ contractId, status: 'OVERDUE' }),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));

    await waitFor(() => {
      const lastCall = listInvoices.mock.lastCall?.[0] as Record<string, unknown>;
      expect(lastCall.contractId).toBeUndefined();
      expect(lastCall.status).toBeUndefined();
    });
  });
});
