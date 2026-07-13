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
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: accessToken(role),
        user: {
          id: '66f7fae3-51ff-ef80-0d1c-160a35760479',
          email: 'operador@example.test',
          role,
          active: true,
        },
      }),
    }),
  );
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
}

async function login(page: Page, role: Role) {
  await mockSession(page, role);
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('operador@example.test');
  await page.getByLabel('Senha').fill('Strong-test-password-123!');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL('/invoices');
  await expect(page.getByRole('heading', { name: 'Faturas', exact: true })).toBeVisible();
}

test('restaura a sessão administrativa durante a aba', async ({ page }) => {
  await login(page, 'ADMIN');
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();

  await page.reload();

  await expect(page).toHaveURL('/invoices');
  await expect(page.getByRole('heading', { name: 'Faturas', exact: true })).toBeVisible();
});

test('impede VIEWER de abrir a gestão de usuários', async ({ page }) => {
  await login(page, 'VIEWER');
  await page.goto('/users');

  await expect(page.getByRole('heading', { name: 'Acesso negado', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Usuários' })).toHaveCount(0);
});
