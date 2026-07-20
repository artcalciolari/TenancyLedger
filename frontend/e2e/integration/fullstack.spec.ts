import { expect, test, type Page } from '@playwright/test';

const password = process.env.E2E_TEST_PASSWORD ?? 'Fullstack-E2E-Password-123!';
const changedPassword = 'Fullstack-E2E-Changed-456!';
const baseUrl =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? '5173'}`;
const ids = {
  seededContract: '40000000-0000-4000-8000-000000000001',
  openInvoice: '50000000-0000-4000-8000-000000000001',
  reviewInvoice: '50000000-0000-4000-8000-000000000002',
  onboardingProperty: '30000000-0000-4000-8000-000000000002',
} as const;

interface CompleteOnboardingResponse {
  draftId: string;
  tenantId: string;
  contractId: string;
  invoiceId: string;
  status: 'COMPLETED';
}

interface OnboardingContractResponse {
  id: string;
  tenantId: string;
  propertyUnitId: string;
  moveInDate: string;
  endDate: string | null;
  durationInMonths: number | null;
  monthlyBaseValueCents: number;
  contractType: string;
  status: string;
}

interface OnboardingInvoiceResponse {
  data: {
    id: string;
    contractId: string;
    competence: string;
    periodStart: string;
    periodEnd: string;
    totalValueCents: number;
    outstandingAmountCents: number;
    status: string;
  }[];
  meta: { total: number };
}

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

async function sessionAccessToken(page: Page): Promise<string> {
  return page.evaluate(() => {
    const value = sessionStorage.getItem('tenancy-ledger:session:v1');
    return value ? (JSON.parse(value) as { accessToken: string }).accessToken : '';
  });
}

test.skip(process.env.E2E_INTEGRATION !== '1', 'Exige a pilha real e o seed full-stack.');
test.describe.configure({ mode: 'serial' });

test('executa cadastro, filtros e conciliação real com segregação e notificações', async ({
  page,
}) => {
  await login(page, 'manager.e2e@example.test');
  const managerAccessToken = await sessionAccessToken(page);

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
  await expect(page.getByText('Engenheira E2E', { exact: true })).toBeVisible();

  await page.goto('/properties/new');
  await page.getByLabel('Bairro').fill('Jardins E2E');
  await page.getByLabel('Número da unidade').fill('E2E-202');
  await page.getByRole('button', { name: 'Cadastrar imóvel' }).click();
  await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);
  const propertyId = page.url().split('/').at(-1);
  expect(propertyId).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.getByText('Jardins E2E', { exact: true })).toBeVisible();

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
  await page.getByRole('button', { name: 'Filtros avançados' }).click();
  await page.getByLabel('ID do locatário').fill(tenantId!);
  await page.getByRole('button', { name: 'Aplicar filtros avançados' }).click();
  await expect(page.getByText(/05\/01\/2099/)).toBeVisible();

  await page.goto('/invoices');
  await page.getByRole('button', { name: 'Em aberto', exact: true }).click();
  await page.getByRole('button', { name: 'Filtros avançados' }).click();
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
    page.getByRole('alert').filter({ hasText: 'Você enviou este pagamento' }).first(),
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
  await page.getByRole('button', { name: 'Ver comprovante' }).click();
  const proofLink = page.getByRole('link', { name: /Abrir comprovante/ });
  await expect(proofLink).toHaveAttribute('href', /payment-proofs/);
  await page.getByRole('button', { name: 'Rejeitar' }).click();
  await page.getByLabel('Motivo').fill('Comprovante recusado pelo cenário E2E.');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('Rejeitado', { exact: true })).toBeVisible();
  await expect(page.getByText(/Comprovante recusado pelo cenário E2E/)).toBeVisible();

  const notifications = await page.request.get(`${baseUrl}/api/notifications?page=1&limit=20`, {
    headers: { Authorization: `Bearer ${managerAccessToken}` },
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

test('conclui onboarding real com duas referências, contrato pendente e primeira fatura', async ({
  page,
}) => {
  await login(page, 'manager.e2e@example.test');
  await page.goto('/onboarding');

  await expect(page.getByRole('heading', { name: 'Dados pessoais' })).toBeVisible();
  await page.getByLabel('Nome completo').fill('Marina Onboarding E2E');
  await page.getByLabel('CPF').fill('11144477735');
  await page.getByLabel('RG').fill('E2E-ONB-01');
  await page.getByLabel('Profissão').fill('Analista de locação');
  await page.getByLabel('E-mail').fill('marina.onboarding.e2e@example.test');
  await page.getByLabel('Celular').fill('11999990003');
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.getByRole('button', { name: 'Adicionar foto depois' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  const referenceNames = page.getByLabel('Nome', { exact: true });
  const relationships = page.getByLabel('Relação com o locatário');
  const referencePhones = page.getByLabel('Telefone');
  await referenceNames.nth(0).fill('Joana Referência E2E');
  await relationships.nth(0).fill('Irmã');
  await referencePhones.nth(0).fill('11988880001');
  await referenceNames.nth(1).fill('Carlos Referência E2E');
  await relationships.nth(1).fill('Colega de trabalho');
  await referencePhones.nth(1).fill('11988880002');
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByRole('heading', { name: 'Escolha o quarto' })).toBeVisible();
  await page.getByLabel('Data de entrada').fill('2099-03-10');
  await page.getByLabel('Bairro').fill('Onboarding E2E');
  const availableResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === 'GET' &&
      url.pathname === '/api/properties/available' &&
      url.searchParams.get('neighborhood') === 'Onboarding E2E'
    );
  });
  await page.getByRole('button', { name: 'Buscar' }).click();
  expect((await availableResponsePromise).ok()).toBeTruthy();
  const availableRoom = page.getByRole('radio', { name: /E2E-ONB-01/ });
  await expect(availableRoom).toBeVisible();
  await availableRoom.click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.getByLabel('Valor mensal').fill('1.875,00');
  await expect(page.getByText(/10\/03\/2099 a 09\/04\/2099/)).toBeVisible();

  const completionResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === 'POST' &&
      /^\/api\/onboarding-drafts\/[0-9a-f-]{36}\/complete$/i.test(url.pathname)
    );
  });
  await page.getByRole('button', { name: 'Concluir cadastro' }).click();
  const completionResponse = await completionResponsePromise;
  expect(completionResponse.ok()).toBeTruthy();
  const completed = (await completionResponse.json()) as CompleteOnboardingResponse;

  expect(completed).toMatchObject({
    status: 'COMPLETED',
    tenantId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    contractId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    invoiceId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
  });
  await expect(page).toHaveURL(`/contracts/${completed.contractId}`);
  await expect(page.getByText('Pendente de assinatura', { exact: true })).toBeVisible();

  const accessToken = await sessionAccessToken(page);
  const headers = { Authorization: `Bearer ${accessToken}` };
  const contractResponse = await page.request.get(
    `${baseUrl}/api/contracts/${completed.contractId}`,
    { headers },
  );
  expect(contractResponse.ok()).toBeTruthy();
  const contract = (await contractResponse.json()) as OnboardingContractResponse;
  expect(contract).toMatchObject({
    id: completed.contractId,
    tenantId: completed.tenantId,
    propertyUnitId: ids.onboardingProperty,
    moveInDate: '2099-03-10',
    endDate: null,
    durationInMonths: null,
    monthlyBaseValueCents: 187500,
    contractType: 'MONTH_TO_MONTH',
    status: 'PENDING_SIGNATURE',
  });

  const invoicesResponse = await page.request.get(
    `${baseUrl}/api/invoices?page=1&limit=20&contractId=${completed.contractId}`,
    { headers },
  );
  expect(invoicesResponse.ok()).toBeTruthy();
  const invoices = (await invoicesResponse.json()) as OnboardingInvoiceResponse;
  expect(invoices.meta.total).toBe(1);
  expect(invoices.data).toEqual([
    expect.objectContaining({
      id: completed.invoiceId,
      contractId: completed.contractId,
      competence: '2099-03',
      periodStart: '2099-03-10',
      periodEnd: '2099-04-09',
      totalValueCents: 187500,
      outstandingAmountCents: 187500,
      status: 'OPEN',
    }),
  ]);
});

test('troca a senha e valida rotação de refresh e logout reais', async ({ page }) => {
  await login(page, 'viewer.e2e@example.test');
  await page.goto('/account/password');
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
