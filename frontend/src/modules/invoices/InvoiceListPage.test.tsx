import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvoiceListPage } from './InvoiceListPage';

const listInvoices = vi.hoisted(() => vi.fn());

vi.mock('./api', () => ({ invoicesApi: { list: listInvoices } }));

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
  });

  it('só aplica o filtro de contrato depois de validar o UUID completo', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(listInvoices).toHaveBeenCalledTimes(1));
    const input = screen.getByRole('textbox', { name: 'ID do contrato' });
    await user.type(input, '123e');
    expect(listInvoices).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(await screen.findByText('Informe um UUID v4 completo.')).toBeInTheDocument();
    expect(listInvoices).toHaveBeenCalledTimes(1);

    const contractId = '123e4567-e89b-42d3-a456-426614174000';
    await user.clear(input);
    await user.type(input, contractId);
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));

    await waitFor(() =>
      expect(listInvoices).toHaveBeenLastCalledWith(
        expect.objectContaining({ contractId, page: 1 }),
      ),
    );
  });
});
