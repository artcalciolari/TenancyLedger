import { expect, test, type Page } from '@playwright/test';

const password = process.env.E2E_TEST_PASSWORD ?? 'Fullstack-E2E-Password-123!';
const changedPassword = 'Fullstack-E2E-Changed-456!';
const baseUrl = 'http://127.0.0.1:5173';
const ids = {
  seededContract: '40000000-0000-4000-8000-000000000001',
  openInvoice: '50000000-0000-4000-8000-000000000001',
  reviewInvoice: '50000000-0000-4000-8000-000000000002',
} as const;

async function login(page: Page, email: string, secret = password): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(secret);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
}

async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login/);
}

test.skip(process.env.E2E_INTEGRATION !== '1', 'Exige a pilha real e o seed full-stack.');
test.describe.configure({ mode: 'serial' });

test('executa cadastro, filtros e conciliação real com segregação e notificações', async ({
  page,
}) => {
  await login(page, 'manager.e2e@example.test');

  await page.goto('/tenants/new');
  await page.getByLabel('Nome completo').fill('Beatriz Engenheira E2E');
  await page.getByLabel('CPF').fill('52998224725');
  await page.getByLabel('RG').fill('E2E-RG-02');
  await page.getByLabel('Profissão').fill('Engenheira E2E');
  await page.getByLabel('E-mail').fill('tenant.created.e2e@example.test');
  await page.getByLabel('Celular').fill('11999990002');
  await page.getByRole('button', { name: 'Cadastrar locatário' }).click();
  await expect(page).toHaveURL(/\/tenants\/[0-9a-f-]{36}$/);
  const tenantId = page.url().split('/').at(-1);
  expect(tenantId).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.getByText('Engenheira E2E')).toBeVisible();

  await page.goto('/properties/new');
  await page.getByLabel('Bairro').fill('Jardins E2E');
  await page.getByLabel('Número da unidade').fill('E2E-202');
  await page.getByRole('button', { name: 'Cadastrar imóvel' }).click();
  await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);
  const propertyId = page.url().split('/').at(-1);
  expect(propertyId).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.getByText('Jardins E2E')).toBeVisible();

  await page.goto('/contracts/new');
  await page
    .getByText('Locatário', { exact: true })
    .locator('..')
    .getByRole('button', { name: 'Selecionar' })
    .click();
  let dialog = page.getByRole('dialog', { name: 'Selecionar locatário' });
  await dialog.getByRole('button', { name: /Engenheira E2E/ }).click();
  await dialog.getByRole('button', { name: 'Confirmar seleção' }).click();

  await page
    .getByText('Imóvel', { exact: true })
    .locator('..')
    .getByRole('button', { name: 'Selecionar' })
    .click();
  dialog = page.getByRole('dialog', { name: 'Selecionar imóvel' });
  await dialog.getByRole('button', { name: /Jardins E2E/ }).click();
  await dialog.getByRole('button', { name: 'Confirmar seleção' }).click();

  await page.getByLabel('Data de entrada').fill('2099-01-05');
  await page.getByLabel('Aluguel mensal').fill('1.750,00');
  await page.getByLabel('Duração em meses').fill('12');
  await page.getByLabel('Dia de cobrança').fill('15');
  await page.getByRole('button', { name: 'Criar contrato' }).click();
  await expect(page).toHaveURL(/\/contracts\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/R\$\s*1\.750,00/)).toBeVisible();

  await page.goto('/contracts');
  await page.getByLabel('ID do locatário').fill(tenantId!);
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(page.getByText(/05\/01\/2099/)).toBeVisible();

  await page.goto('/invoices');
  await page.getByRole('combobox', { name: 'Status' }).click();
  await page.getByRole('option', { name: 'Em aberto' }).click();
  await page.getByLabel('ID do contrato').fill(ids.seededContract);
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(page.getByRole('cell', { name: '01/2099', exact: true })).toBeVisible();

  await page.goto(`/invoices/${ids.openInvoice}`);
  await page.getByRole('button', { name: 'Registrar pagamento' }).click();
  await page.getByLabel('Valor').fill('500,00');
  await page.getByRole('combobox', { name: 'Tipo de comprovante' }).click();
  await page.getByRole('option', { name: 'Comprovante digital' }).click();
  await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/payment-proof.pdf');
  await page.getByRole('button', { name: 'Enviar para revisão' }).click();
  await expect(page.getByText('Enviado', { exact: true })).toBeVisible();

  await page.goto('/payments/review');
  await page.getByLabel('Buscar pagamento').fill('Bairro Seed E2E');
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(
    page.getByText(/Revisão indisponível: você enviou este pagamento/).first(),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aprovar' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rejeitar' })).toHaveCount(0);

  await logout(page);
  await login(page, 'admin.e2e@example.test');

  await page.goto(`/invoices/${ids.reviewInvoice}`);
  await page.getByRole('button', { name: 'Aprovar' }).click();
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('Aprovado', { exact: true })).toBeVisible();

  await page.goto(`/invoices/${ids.openInvoice}`);
  await page.getByRole('button', { name: 'Gerar acesso' }).click();
  const proofLink = page.getByRole('link', { name: /Abrir comprovante/ });
  await expect(proofLink).toHaveAttribute('href', /payment-proofs/);
  await page.getByRole('button', { name: 'Rejeitar' }).click();
  await page.getByLabel('Motivo').fill('Comprovante recusado pelo cenário E2E.');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('Rejeitado', { exact: true })).toBeVisible();
  await expect(page.getByText(/Comprovante recusado pelo cenário E2E/)).toBeVisible();

  await logout(page);
  await login(page, 'manager.e2e@example.test');
  const accessToken = await page.evaluate(() => {
    const value = sessionStorage.getItem('tenancy-ledger:session:v1');
    return value ? (JSON.parse(value) as { accessToken: string }).accessToken : '';
  });
  const notifications = await page.request.get(`${baseUrl}/api/notifications?page=1&limit=20`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(notifications.ok()).toBeTruthy();
  const notificationBody = (await notifications.json()) as {
    data: { type: string }[];
    unreadCount: number;
  };
  expect(notificationBody.data.map((item) => item.type)).toEqual(
    expect.arrayContaining(['PAYMENT_APPROVED', 'PAYMENT_REJECTED']),
  );
  expect(notificationBody.unreadCount).toBeGreaterThanOrEqual(2);
});

test('troca a senha e valida rotação de refresh e logout reais', async ({ page }) => {
  await login(page, 'viewer.e2e@example.test');
  await page.getByRole('link', { name: 'Minha conta' }).click();
  await page.getByLabel('Senha atual').fill(password);
  await page.getByLabel('Nova senha', { exact: true }).fill(changedPassword);
  await page.getByLabel('Confirmar nova senha').fill(changedPassword);
  await page.getByRole('button', { name: 'Alterar senha' }).click();
  await expect(page).toHaveURL('/login?reason=password-changed');
  await expect(page.getByText('Senha alterada. Entre novamente para continuar.')).toBeVisible();

  await login(page, 'viewer.e2e@example.test', changedPassword);
  const previousAccessToken = await page.evaluate(() => {
    const value = sessionStorage.getItem('tenancy-ledger:session:v1');
    return value ? (JSON.parse(value) as { accessToken: string }).accessToken : '';
  });
  const refreshCookieBefore = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'refresh_token',
  );
  const refresh = await page.request.post(`${baseUrl}/api/auth/refresh`);
  expect(refresh.ok()).toBeTruthy();
  const refreshed = (await refresh.json()) as { accessToken: string };
  const refreshCookieAfter = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'refresh_token',
  );
  expect(previousAccessToken).toBeTruthy();
  expect(refreshed.accessToken).toBeTruthy();
  expect(refreshCookieBefore?.value).toBeTruthy();
  expect(refreshCookieAfter?.value).toBeTruthy();
  expect(refreshCookieAfter?.value).not.toBe(refreshCookieBefore?.value);

  const logoutResponse = await page.request.post(`${baseUrl}/api/auth/logout`);
  expect(logoutResponse.status()).toBe(204);
  const refreshAfterLogout = await page.request.post(`${baseUrl}/api/auth/refresh`);
  expect(refreshAfterLogout.status()).toBe(401);

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login/);
});
