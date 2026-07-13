import { expect, test, type Page } from '@playwright/test';

type Role = 'ADMIN' | 'MANAGER' | 'VIEWER';

function accessToken(role: Role): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: '66f7fae3-51ff-ef80-0d1c-160a35760479',
      email: 'operador@example.test',
      role,
      exp: Math.floor(Date.now() / 1000) + 15 * 60,
    }),
  ).toString('base64url');
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.test-signature`;
}

async function mockSession(page: Page, role: Role) {
  let authenticated = false;
  const state = { logoutRequests: 0 };
  const response = () => ({
    accessToken: accessToken(role),
    user: {
      id: '66f7fae3-51ff-ef80-0d1c-160a35760479',
      email: 'operador@example.test',
      role,
      active: true,
    },
  });
  await page.route('**/api/auth/login', (route) => {
    authenticated = true;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response()),
    });
  });
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill(
      authenticated
        ? { status: 200, contentType: 'application/json', body: JSON.stringify(response()) }
        : {
            status: 401,
            contentType: 'application/problem+json',
            body: JSON.stringify({ title: 'Unauthorized', status: 401 }),
          },
    ),
  );
  await page.route('**/api/auth/logout', (route) => {
    authenticated = false;
    state.logoutRequests += 1;
    return route.fulfill({ status: 204 });
  });
  await page.route('**/api/invoices**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }),
    }),
  );
  await page.route('**/api/dashboard/summary', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        asOf: '2026-07-12',
        contracts: { total: 1, active: 1, expired: 0, expiringNext30Days: 0 },
        invoices: {
          total: 0,
          underReview: 0,
          overdue: 0,
          totalAmountCents: 0,
          approvedAmountCents: 0,
          outstandingAmountCents: 0,
          overdueAmountCents: 0,
        },
        payments: { submitted: 0, approved: 0, rejected: 0 },
      }),
    }),
  );
  await page.route('**/api/notifications**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        unreadCount: 0,
      }),
    }),
  );
  return state;
}

async function login(page: Page, role: Role) {
  const state = await mockSession(page, role);
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('operador@example.test');
  await page.getByLabel('Senha').fill('Strong-test-password-123!');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('heading', { name: 'Visão geral', exact: true })).toBeVisible();
  return state;
}

test('restaura a sessão administrativa durante a aba', async ({ page }) => {
  await login(page, 'ADMIN');
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();

  await page.reload();

  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('heading', { name: 'Visão geral', exact: true })).toBeVisible();
});

test('impede VIEWER de abrir a gestão de usuários', async ({ page }) => {
  await login(page, 'VIEWER');
  await page.goto('/users');

  await expect(page.getByRole('heading', { name: 'Acesso negado', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Usuários' })).toHaveCount(0);
});

test('revoga o cookie e volta ao login ao sair', async ({ page }) => {
  const state = await login(page, 'ADMIN');

  await page.getByRole('button', { name: 'Sair' }).click();

  await expect.poll(() => state.logoutRequests).toBe(1);
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});
