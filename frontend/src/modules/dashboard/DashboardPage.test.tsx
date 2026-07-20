import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardPage } from './DashboardPage';

const summary = vi.hoisted(() => vi.fn());
const invoices = vi.hoisted(() => vi.fn());
const notifications = vi.hoisted(() => vi.fn());

vi.mock('./api', () => ({ dashboardApi: { summary } }));
vi.mock('../invoices/api', () => ({ invoicesApi: { list: invoices } }));
vi.mock('../notifications/api', () => ({ notificationsApi: { list: notifications } }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ session: { user: { id: 'user-id', role: 'ADMIN' } } }),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    summary.mockReset().mockResolvedValue({
      asOf: '2026-07-18',
      period: { from: '2026-07-01', to: '2026-07-18', forecastThrough: '2026-08-17' },
      financial: {
        receivedCents: 150_000,
        confirmedReceivableCents: 75_000,
        forecastRenewalsCents: 90_000,
        byProperty: [
          {
            propertyUnitId: 'property-id',
            buildingId: 'building-id',
            buildingName: 'Edifício Sol',
            neighborhood: 'Centro',
            unitNumber: '101',
            receivedCents: 150_000,
            confirmedReceivableCents: 75_000,
            forecastRenewalsCents: 90_000,
          },
        ],
        byBuilding: [
          {
            buildingId: 'building-id',
            buildingName: 'Edifício Sol',
            neighborhood: 'Centro',
            propertyUnitCount: 1,
            receivedCents: 150_000,
            confirmedReceivableCents: 75_000,
            forecastRenewalsCents: 90_000,
          },
        ],
        daily: [
          {
            date: '2026-07-18',
            receivedCents: 150_000,
            confirmedReceivableCents: 75_000,
            forecastRenewalsCents: 0,
          },
          {
            date: '2026-08-01',
            receivedCents: 0,
            confirmedReceivableCents: 0,
            forecastRenewalsCents: 90_000,
          },
        ],
      },
      contracts: { total: 1, active: 1, expired: 0, terminated: 0, expiringNext30Days: 0 },
      invoices: {
        total: 1,
        totalValueCents: 225_000,
        approvedAmountCents: 150_000,
        outstandingAmountCents: 75_000,
        overdueAmountCents: 0,
        underReview: 0,
      },
      payments: { submitted: 0 },
    });
    invoices.mockReset().mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 5, total: 0, totalPages: 0 },
    });
    notifications.mockReset().mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      unreadCount: 0,
    });
  });

  it('separa os três conceitos e mostra os recortes por prédio, imóvel e dia', async () => {
    renderPage();

    expect((await screen.findAllByText('Recebido')).length).toBeGreaterThan(0);
    expect(screen.getByText('A receber confirmado')).toBeInTheDocument();
    expect(screen.getByText('Renovações previstas')).toBeInTheDocument();
    expect(screen.getAllByText((text) => text.includes('1.500,00')).length).toBeGreaterThan(0);
    expect(screen.getByText('Edifício Sol · Unid. 101')).toBeInTheDocument();
    const buildingTable = screen.getByRole('table', { name: 'Posição financeira por prédio' });
    expect(buildingTable).toBeInTheDocument();
    expect(buildingTable).toHaveTextContent('1 unidade');
    expect(
      screen.getByRole('img', {
        name: 'Série diária de valores recebidos, a receber e previstos',
      }),
    ).toBeInTheDocument();
  });
});
