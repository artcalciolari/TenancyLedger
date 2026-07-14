import { expect, test, type Page } from '@playwright/test';

// Baselines: mcr.microsoft.com/playwright:v1.61.1-noble. Mantenha a tag alinhada ao lockfile.

const session = {
  accessToken: createAccessToken(),
  user: {
    id: '10000000-0000-4000-8000-000000000001',
    email: 'admin.visual@example.test',
    role: 'ADMIN',
    active: true,
  },
};

function createAccessToken(): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: '10000000-0000-4000-8000-000000000001',
      email: 'admin.visual@example.test',
      role: 'ADMIN',
      exp: 4_102_444_800,
    }),
  ).toString('base64url');
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.visual-signature`;
}

async function json(route: Parameters<Parameters<Page['route']>[1]>[0], body: unknown) {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockApi(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('tenancy-ledger:theme-preference:v1', 'light');
  });
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/problem+json',
      body: JSON.stringify({ title: 'Unauthorized', status: 401 }),
    }),
  );
  await page.route('**/api/auth/login', (route) => json(route, session));
  await page.route('**/api/notifications**', (route) =>
    json(route, {
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      unreadCount: 0,
    }),
  );
  await page.route('**/api/dashboard/summary', (route) =>
    json(route, {
      asOf: '2026-07-13',
      contracts: { total: 18, active: 14, expired: 3, terminated: 1, expiringNext30Days: 2 },
      invoices: {
        total: 42,
        underReview: 3,
        totalValueCents: 6_300_000,
        approvedAmountCents: 4_125_000,
        outstandingAmountCents: 2_175_000,
        overdueAmountCents: 625_000,
      },
      payments: { submitted: 4 },
    }),
  );
  await page.route('**/api/invoices?**', (route) =>
    json(route, {
      data: [
        {
          id: '50000000-0000-4000-8000-000000000001',
          contractId: '40000000-0000-4000-8000-000000000001',
          competence: '2026-07',
          dueDate: '2026-07-10',
          totalValueCents: 250_000,
          approvedAmountCents: 100_000,
          outstandingAmountCents: 150_000,
          status: 'UNDER_REVIEW',
          createdAt: '2026-07-01T12:00:00.000Z',
          updatedAt: '2026-07-13T12:00:00.000Z',
          payments: [],
          contract: {
            id: '40000000-0000-4000-8000-000000000001',
            tenantId: '20000000-0000-4000-8000-000000000001',
            propertyUnitId: '30000000-0000-4000-8000-000000000001',
            status: 'ACTIVE',
            tenant: {
              id: '20000000-0000-4000-8000-000000000001',
              name: 'Larissa Andrade',
              cpf: '***.***.***-09',
              email: 'l***@example.test',
              mobilePhone: '(**) *****-9001',
              profession: 'Engenheira civil',
              civilStatus: 'SINGLE',
            },
            propertyUnit: {
              id: '30000000-0000-4000-8000-000000000001',
              neighborhood: 'Jardins',
              unitNumber: '101-A',
              type: 'APARTMENT',
            },
          },
        },
        {
          id: '50000000-0000-4000-8000-000000000002',
          contractId: '40000000-0000-4000-8000-000000000002',
          competence: '2026-06',
          dueDate: '2026-06-10',
          totalValueCents: 180_000,
          approvedAmountCents: 180_000,
          outstandingAmountCents: 0,
          status: 'PAID',
          createdAt: '2026-06-01T12:00:00.000Z',
          updatedAt: '2026-06-12T12:00:00.000Z',
          payments: [],
          contract: {
            id: '40000000-0000-4000-8000-000000000002',
            tenantId: '20000000-0000-4000-8000-000000000002',
            propertyUnitId: '30000000-0000-4000-8000-000000000002',
            status: 'ACTIVE',
            tenant: {
              id: '20000000-0000-4000-8000-000000000002',
              name: 'Marcelo Nogueira',
              cpf: '***.***.***-42',
              email: 'm***@example.test',
              mobilePhone: '(**) *****-9002',
              profession: 'Analista de sistemas',
              civilStatus: 'MARRIED',
            },
            propertyUnit: {
              id: '30000000-0000-4000-8000-000000000002',
              neighborhood: 'Centro',
              unitNumber: '52',
              type: 'COMMERCIAL',
            },
          },
        },
      ],
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    }),
  );
}

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('admin.visual@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('Visual-Test-Password-123!');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL('/dashboard');
}

const screenshotOptions = {
  animations: 'disabled' as const,
  caret: 'hide' as const,
  maxDiffPixelRatio: 0.001,
  scale: 'css' as const,
};

test.beforeEach(async ({ page }) => mockApi(page));

test('login', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('Tenancy Ledger')).toBeVisible();
  await expect(page.getByLabel('E-mail')).toBeVisible();
  await expect(page).toHaveScreenshot('login.png', screenshotOptions);
});

test('dashboard', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('heading', { name: 'Visão geral', exact: true })).toBeVisible();
  await expect(page.getByText('R$ 21.750,00')).toBeVisible();
  await expect(page).toHaveScreenshot('dashboard.png', screenshotOptions);
});

test('faturas', async ({ page }) => {
  await login(page);
  await page.goto('/invoices');
  await expect(page.getByRole('heading', { name: 'Faturas', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '07/2026', exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot('invoices.png', screenshotOptions);
});
