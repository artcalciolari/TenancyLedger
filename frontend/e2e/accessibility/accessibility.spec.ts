import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

function accessToken(): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: '66f7fae3-51ff-4f80-8d1c-160a35760479',
      email: 'admin@example.test',
      role: 'ADMIN',
      exp: Math.floor(Date.now() / 1000) + 15 * 60,
    }),
  ).toString('base64url');
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.test-signature`;
}

async function mockAuthenticatedApi(page: Page): Promise<void> {
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/problem+json',
      body: JSON.stringify({ title: 'Unauthorized', status: 401 }),
    }),
  );
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: accessToken(),
        user: {
          id: '66f7fae3-51ff-4f80-8d1c-160a35760479',
          email: 'admin@example.test',
          role: 'ADMIN',
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
  await page.route('**/api/dashboard/summary', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        asOf: '2026-07-12',
        contracts: { total: 0, active: 0, expired: 0, terminated: 0, expiringNext30Days: 0 },
        invoices: {
          total: 0,
          underReview: 0,
          totalValueCents: 0,
          approvedAmountCents: 0,
          outstandingAmountCents: 0,
          overdueAmountCents: 0,
        },
        payments: { submitted: 0 },
      }),
    }),
  );
}

async function wcagViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .options({ rules: { 'target-size': { enabled: true } } })
    .analyze();
  return result.violations;
}

async function authenticate(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('admin@example.test');
  await page.getByLabel('Senha').fill('Strong-test-password-123!');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
}

test('login não possui violações WCAG AA', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Tenancy Ledger' })).toBeVisible();

  expect(await wcagViolations(page)).toEqual([]);
});

test('shell autenticado e estado vazio não possuem violações WCAG AA', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('admin@example.test');
  await page.getByLabel('Senha').fill('Strong-test-password-123!');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('link', { name: 'Faturas' }).click();
  await expect(page.getByRole('heading', { name: 'Faturas', exact: true })).toBeVisible();

  expect(await wcagViolations(page)).toEqual([]);
});

test('login mantém ordem de foco e direciona o primeiro erro', async ({ page }) => {
  await page.goto('/login');
  const email = page.getByLabel('E-mail');
  const password = page.getByLabel('Senha');
  const submit = page.getByRole('button', { name: 'Entrar' });

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Tab');
  await expect(email).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(password).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(submit).toBeFocused();
  await submit.click();
  await expect(email).toBeFocused();
});

test('drawer móvel captura o foco e o devolve ao acionador', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile-'), 'Fluxo exclusivo do drawer móvel.');
  await mockAuthenticatedApi(page);
  await authenticate(page);

  const opener = page.getByRole('button', { name: 'Abrir menu' });
  await opener.click();
  const close = page.getByRole('button', { name: 'Fechar menu' });
  await expect(close).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
});

test('diálogo de pagamento mantém e restaura o foco', async ({ page }) => {
  const invoiceId = '50000000-0000-4000-8000-000000000001';
  await mockAuthenticatedApi(page);
  await page.route(`**/api/invoices/${invoiceId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: invoiceId,
        contractId: '40000000-0000-4000-8000-000000000001',
        competence: '2026-07',
        dueDate: '2026-07-10',
        totalValueCents: 100000,
        approvedAmountCents: 0,
        outstandingAmountCents: 100000,
        status: 'OPEN',
        payments: [],
        createdAt: '2026-07-01T12:00:00.000Z',
        updatedAt: '2026-07-01T12:00:00.000Z',
      }),
    }),
  );
  await authenticate(page);
  await page.goto(`/invoices/${invoiceId}`);

  const opener = page.getByRole('button', { name: 'Registrar pagamento' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Registrar pagamento' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Valor' })).toBeFocused();

  for (let step = 0; step < 8; step += 1) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});
