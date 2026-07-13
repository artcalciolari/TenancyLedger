import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewPaymentsPage } from './ReviewPaymentsPage';

const reviewPayments = vi.hoisted(() => vi.fn());

vi.mock('./api', () => ({ invoicesApi: { review: reviewPayments } }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    session: {
      accessToken: 'token',
      user: { id: 'operator-1', email: 'manager@example.com', role: 'MANAGER', active: true },
    },
  }),
}));

describe('ReviewPaymentsPage', () => {
  beforeEach(() => {
    reviewPayments.mockReset();
    reviewPayments.mockImplementation(({ page }: { page: number }) =>
      Promise.resolve(
        page === 3
          ? { data: [], meta: { page: 3, limit: 20, total: 21, totalPages: 2 } }
          : { data: [], meta: { page: 2, limit: 20, total: 21, totalPages: 2 } },
      ),
    );
  });

  it('recua para a última página disponível quando a fila diminui', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/payments/review?page=3&limit=20']}>
          <ReviewPaymentsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(reviewPayments).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 20 })),
    );
  });
});
