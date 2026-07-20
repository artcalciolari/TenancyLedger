import { expect, test, type Page, type Route } from '@playwright/test';

const userId = '10000000-0000-4000-8000-000000000001';

function accessToken(): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      email: 'admin.ipad@example.test',
      role: 'ADMIN',
      exp: 4_102_444_800,
    }),
  ).toString('base64url');
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.ipad-dashboard-signature`;
}

function json(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function mockDashboard(page: Page): Promise<void> {
  await page.addInitScript(
    ({ token, id }) => {
      localStorage.setItem('tenancy-ledger:theme-preference:v1', 'light');
      sessionStorage.setItem(
        'tenancy-ledger:session:v1',
        JSON.stringify({
          accessToken: token,
          user: { id, email: 'admin.ipad@example.test', role: 'ADMIN', active: true },
        }),
      );
    },
    { token: accessToken(), id: userId },
  );
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    if (path === '/api/notifications') {
      return json(route, {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        unreadCount: 0,
      });
    }
    if (path === '/api/invoices') {
      return json(route, {
        data: [],
        meta: { page: 1, limit: 5, total: 0, totalPages: 0 },
      });
    }
    if (path === '/api/dashboard/summary') {
      return json(route, {
        asOf: '2026-07-18',
        period: { from: '2026-07-01', to: '2026-07-18', forecastThrough: '2026-08-17' },
        financial: {
          receivedCents: 1_250_000,
          confirmedReceivableCents: 675_000,
          forecastRenewalsCents: 900_000,
          byProperty: [
            {
              propertyUnitId: '30000000-0000-4000-8000-000000000001',
              buildingId: '60000000-0000-4000-8000-000000000001',
              buildingName: 'Residencial Aurora',
              neighborhood: 'Centro',
              unitNumber: '12-B',
              receivedCents: 750_000,
              confirmedReceivableCents: 375_000,
              forecastRenewalsCents: 450_000,
            },
            {
              propertyUnitId: '30000000-0000-4000-8000-000000000002',
              buildingId: null,
              buildingName: null,
              neighborhood: 'Jardins',
              unitNumber: '101',
              receivedCents: 500_000,
              confirmedReceivableCents: 300_000,
              forecastRenewalsCents: 450_000,
            },
          ],
          byBuilding: [
            {
              buildingId: '60000000-0000-4000-8000-000000000001',
              buildingName: 'Residencial Aurora',
              neighborhood: 'Centro',
              propertyUnitCount: 1,
              receivedCents: 750_000,
              confirmedReceivableCents: 375_000,
              forecastRenewalsCents: 450_000,
            },
            {
              buildingId: null,
              buildingName: null,
              neighborhood: 'Jardins',
              propertyUnitCount: 1,
              receivedCents: 500_000,
              confirmedReceivableCents: 300_000,
              forecastRenewalsCents: 450_000,
            },
          ],
          daily: [
            {
              date: '2026-07-05',
              receivedCents: 400_000,
              confirmedReceivableCents: 225_000,
              forecastRenewalsCents: 0,
            },
            {
              date: '2026-07-18',
              receivedCents: 850_000,
              confirmedReceivableCents: 450_000,
              forecastRenewalsCents: 0,
            },
            {
              date: '2026-08-01',
              receivedCents: 0,
              confirmedReceivableCents: 0,
              forecastRenewalsCents: 900_000,
            },
          ],
        },
        contracts: { total: 18, active: 14, expired: 3, terminated: 1, expiringNext30Days: 2 },
        invoices: {
          total: 12,
          underReview: 1,
          totalValueCents: 2_825_000,
          approvedAmountCents: 1_250_000,
          outstandingAmountCents: 675_000,
          overdueAmountCents: 125_000,
        },
        payments: { submitted: 1 },
      });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
}

test('dashboard financeiro mantém o layout de livro-razão no iPad', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'ipad', 'Baseline dedicada ao viewport iPad landscape.');
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await mockDashboard(page);
  await page.goto('/dashboard');

  await page.waitForLoadState('networkidle');
  expect(pageErrors).toEqual([]);
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
  await expect(page.getByText('A receber confirmado')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot('dashboard-ipad.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.001,
    scale: 'css',
  });
});
