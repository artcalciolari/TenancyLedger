import { expect, test, type Page, type Route } from '@playwright/test';

const userId = '10000000-0000-4000-8000-000000000001';
const closingDate = '2026-07-18';

function accessToken(): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      email: 'admin.cashbox@example.test',
      role: 'ADMIN',
      exp: 4_102_444_800,
    }),
  ).toString('base64url');
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.cashbox-signature`;
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function authenticate(page: Page): Promise<void> {
  await page.addInitScript(
    ({ token, id }) => {
      sessionStorage.setItem(
        'tenancy-ledger:session:v1',
        JSON.stringify({
          accessToken: token,
          user: {
            id,
            email: 'admin.cashbox@example.test',
            role: 'ADMIN',
            active: true,
          },
        }),
      );
    },
    { token: accessToken(), id: userId },
  );
}

test('fecha o caixa com divergência e permite reabertura auditada', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  let closing: Record<string, unknown> | null = null;
  const countedValues: number[] = [];
  let reopenReason: string | null = null;

  await authenticate(page);
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    if (path === '/api/notifications') {
      return json(route, {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        unreadCount: 0,
      });
    }
    if (path === '/api/cash-closings' && request.method() === 'GET') {
      return json(route, closing ? [closing] : []);
    }
    if (path === `/api/cash-closings/${closingDate}` && request.method() === 'GET') {
      if (closing) return json(route, closing);
      return route.fulfill({
        status: 404,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: 'about:blank',
          title: 'Not Found',
          status: 404,
          detail: 'Fechamento não encontrado.',
        }),
      });
    }
    if (path === `/api/cash-closings/${closingDate}` && request.method() === 'POST') {
      const countedCashCents = (request.postDataJSON() as { countedCashCents: number })
        .countedCashCents;
      countedValues.push(countedCashCents);
      closing = {
        id: '80000000-0000-4000-8000-000000000001',
        closingDate,
        expectedCashCents: 100_000,
        countedCashCents,
        differenceCents: countedCashCents - 100_000,
        status: 'CLOSED',
        closedBy: userId,
        closedAt: '2026-07-18T22:00:00.000Z',
        reopenReason: null,
        reopenedBy: null,
        reopenedAt: null,
      };
      return json(route, closing);
    }
    if (path === `/api/cash-closings/${closingDate}/reopen` && request.method() === 'POST') {
      reopenReason = (request.postDataJSON() as { reason: string }).reason;
      closing = {
        ...closing,
        status: 'REOPENED',
        reopenReason,
        reopenedBy: userId,
        reopenedAt: '2026-07-18T22:15:00.000Z',
      };
      return json(route, closing);
    }
    return json(route, { title: 'Not mocked', status: 404 }, 404);
  });

  await page.goto(`/cashbox?date=${closingDate}`);
  await page.waitForLoadState('networkidle');
  expect(pageErrors).toEqual([]);
  await expect(page.getByRole('heading', { name: 'Fechamento de caixa' })).toBeVisible();
  await page.getByLabel('Dinheiro contado').fill('980,00');
  await page.getByRole('button', { name: 'Fechar caixa' }).click();

  await expect.poll(() => countedValues).toEqual([98_000]);
  await expect(page.getByText('Fechado', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('-R$ 20,00').first()).toBeVisible();

  await page.getByRole('button', { name: 'Reabrir caixa' }).click();
  const dialog = page.getByRole('dialog', { name: /Reabrir caixa/ });
  await dialog.getByRole('textbox', { name: /Motivo/ }).fill('Correção da contagem física.');
  await dialog.getByRole('button', { name: 'Confirmar reabertura' }).click();

  await expect.poll(() => reopenReason).toBe('Correção da contagem física.');
  await expect(page.getByText('Reaberto', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Motivo da reabertura: Correção da contagem física.')).toBeVisible();

  await page.getByLabel('Dinheiro contado').fill('1.000,00');
  await page.getByRole('button', { name: 'Fechar caixa novamente' }).click();
  await expect.poll(() => countedValues).toEqual([98_000, 100_000]);
  await expect(page.getByText('Fechado', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('R$ 0,00').first()).toBeVisible();
});
