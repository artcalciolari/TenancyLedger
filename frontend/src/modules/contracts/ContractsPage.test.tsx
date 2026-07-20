import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractsPage } from './ContractsPage';

const listContracts = vi.hoisted(() => vi.fn());

vi.mock('./api', () => ({
  contractsApi: { list: listContracts, exportCsv: vi.fn() },
}));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    session: {
      accessToken: 'token',
      user: { id: 'operator-1', email: 'manager@example.com', role: 'MANAGER', active: true },
    },
  }),
}));

function renderPage(initialEntry = '/contracts') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <ContractsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ContractsPage', () => {
  beforeEach(() => {
    listContracts.mockReset();
    listContracts.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it('usa renewalAttention ao ativar o chip "Renovações" e limpa o filtro de status', async () => {
    const user = userEvent.setup();
    renderPage('/contracts?status=ACTIVE');

    await waitFor(() =>
      expect(listContracts).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE' })),
    );

    await user.click(screen.getByRole('button', { name: 'Renovações' }));

    await waitFor(() =>
      expect(listContracts).toHaveBeenLastCalledWith(
        expect.objectContaining({ renewalAttention: true, status: undefined }),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Renovações' }));

    await waitFor(() => {
      const lastCall = listContracts.mock.calls.at(-1)?.[0] as { renewalAttention?: boolean };
      expect(lastCall?.renewalAttention).toBeUndefined();
    });
  });

  it('lê renewalAttention=true da URL e ativa o chip', async () => {
    renderPage('/contracts?renewalAttention=true');

    await waitFor(() =>
      expect(listContracts).toHaveBeenCalledWith(
        expect.objectContaining({ renewalAttention: true }),
      ),
    );
    expect(screen.getByRole('button', { name: 'Renovações' })).toHaveClass('MuiChip-filled');
  });

  it('sai de Renovações ao escolher um chip de status', async () => {
    const user = userEvent.setup();
    renderPage('/contracts?renewalAttention=true');

    await waitFor(() =>
      expect(listContracts).toHaveBeenCalledWith(
        expect.objectContaining({ renewalAttention: true }),
      ),
    );
    expect(screen.getByRole('button', { name: 'Renovações' })).toHaveClass('MuiChip-filled');

    await user.click(screen.getByRole('button', { name: 'Ativos' }));

    await waitFor(() => {
      const lastCall = listContracts.mock.calls.at(-1)?.[0] as {
        status?: string;
        badge?: string;
        renewalAttention?: boolean;
      };
      expect(lastCall?.status).toBe('ACTIVE');
      expect(lastCall?.renewalAttention).toBeUndefined();
      expect(lastCall?.badge).toBeUndefined();
    });
    expect(screen.getByRole('button', { name: 'Ativos' })).toHaveClass('MuiChip-filled');
    expect(screen.getByRole('button', { name: 'Renovações' })).not.toHaveClass('MuiChip-filled');
  });
});
