import { expect, test, type Page, type Route } from '@playwright/test';

const ids = {
  user: '10000000-0000-4000-8000-000000000001',
  tenant: '20000000-0000-4000-8000-000000000001',
  property: '30000000-0000-4000-8000-000000000001',
  contract: '40000000-0000-4000-8000-000000000001',
  invoice: '50000000-0000-4000-8000-000000000001',
  document: '60000000-0000-4000-8000-000000000001',
  receipt: '70000000-0000-4000-8000-000000000001',
} as const;

function accessToken(): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: ids.user,
      email: 'atendimento@example.test',
      role: 'MANAGER',
      exp: 4_102_444_800,
    }),
  ).toString('base64url');
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.first-payment-signature`;
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function invoice(status: 'OPEN' | 'PAID') {
  return {
    id: ids.invoice,
    contractId: ids.contract,
    competence: '2026-07',
    periodStart: '2026-07-18',
    periodEnd: '2026-08-17',
    dueDate: '2026-07-18',
    totalValueCents: 150_000,
    approvedAmountCents: status === 'PAID' ? 150_000 : 0,
    outstandingAmountCents: status === 'PAID' ? 0 : 150_000,
    status,
    payments: [],
    createdAt: '2026-07-18T12:00:00.000Z',
    updatedAt: '2026-07-18T12:00:00.000Z',
  };
}

async function authenticate(page: Page): Promise<void> {
  await page.addInitScript(
    ({ token, userId }) => {
      sessionStorage.setItem(
        'tenancy-ledger:session:v1',
        JSON.stringify({
          accessToken: token,
          user: {
            id: userId,
            email: 'atendimento@example.test',
            role: 'MANAGER',
            active: true,
          },
        }),
      );
    },
    { token: accessToken(), userId: ids.user },
  );
}

test('assina o contrato mensal, registra o primeiro CASH e emite o recibo', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'ipad', 'Fluxo presencial validado no projeto iPad.');

  let contractStatus = 'PENDING_SIGNATURE';
  let invoiceStatus: 'OPEN' | 'PAID' = 'OPEN';
  let signedDocument: Record<string, unknown> | null = null;
  let usedDocumentMultipartField = false;
  let settledAmount: number | null = null;
  let receiptDownloaded = false;

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
    if (path === `/api/contracts/${ids.contract}` && request.method() === 'GET') {
      return json(route, {
        id: ids.contract,
        tenantId: ids.tenant,
        propertyUnitId: ids.property,
        moveInDate: '2026-07-18',
        endDate: null,
        monthlyBaseValueCents: 150_000,
        durationInMonths: null,
        billingDay: 18,
        isRenewable: true,
        contractType: 'MONTH_TO_MONTH',
        status: contractStatus,
        statusReason: null,
        statusChangedAt: '2026-07-18T12:00:00.000Z',
        paidThroughDate: invoiceStatus === 'PAID' ? '2026-08-17' : null,
        nextRenewalDate: invoiceStatus === 'PAID' ? '2026-08-18' : null,
        badges: [],
        createdAt: '2026-07-18T12:00:00.000Z',
        updatedAt: '2026-07-18T12:00:00.000Z',
      });
    }
    if (path === `/api/tenants/${ids.tenant}`) {
      return json(route, {
        id: ids.tenant,
        name: 'Marina Oliveira',
        cpf: '529.982.247-25',
        rg: '12.345.678-9',
        profession: 'Enfermeira',
        email: 'marina@example.test',
        mobilePhone: '(11) 99999-9999',
        civilStatus: 'SINGLE',
        active: true,
        createdAt: '2026-07-18T12:00:00.000Z',
        updatedAt: '2026-07-18T12:00:00.000Z',
      });
    }
    if (path === `/api/properties/${ids.property}`) {
      return json(route, {
        id: ids.property,
        neighborhood: 'Centro',
        unitNumber: '12-B',
        type: 'ROOM',
        buildingId: null,
        occupied: true,
        createdAt: '2026-07-18T12:00:00.000Z',
        updatedAt: '2026-07-18T12:00:00.000Z',
      });
    }
    if (path === '/api/invoices' && request.method() === 'GET') {
      return json(route, {
        data: [invoice(invoiceStatus)],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    }
    if (path === `/api/contracts/${ids.contract}/documents` && request.method() === 'GET') {
      return json(route, signedDocument ? [signedDocument] : []);
    }
    if (path === `/api/contracts/${ids.contract}/documents` && request.method() === 'POST') {
      const multipart = request.postDataBuffer()?.toString('utf8') ?? '';
      usedDocumentMultipartField =
        multipart.includes('name="document"; filename="contrato-assinado.pdf"') &&
        multipart.includes('name="kind"') &&
        multipart.includes('SIGNED');
      contractStatus = 'PAYMENT_PENDING';
      signedDocument = {
        id: ids.document,
        contractId: ids.contract,
        kind: 'SIGNED',
        version: 1,
        originalName: 'contrato-assinado.pdf',
        contentType: 'application/pdf',
        uploadedByUserId: ids.user,
        createdAt: '2026-07-18T13:00:00.000Z',
        url: '/api/mock-contract-document.pdf',
        expiresInSeconds: 300,
      };
      return json(route, signedDocument, 201);
    }
    if (path === `/api/invoices/${ids.invoice}/settle-cash` && request.method() === 'POST') {
      settledAmount = (request.postDataJSON() as { amountCents: number }).amountCents;
      expect(request.headers()['idempotency-key']).toBeTruthy();
      invoiceStatus = 'PAID';
      contractStatus = 'ACTIVE';
      return json(route, { invoice: invoice('PAID'), receiptId: ids.receipt }, 201);
    }
    if (path === `/api/receipts/${ids.receipt}/download`) {
      receiptDownloaded = true;
      return json(route, { url: '/api/mock-receipt.pdf', expiresInSeconds: 300 });
    }
    if (path === '/api/mock-receipt.pdf' || path === '/api/mock-contract-document.pdf') {
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4 mock' });
    }
    return json(route, { title: 'Not mocked', status: 404 }, 404);
  });

  await page.goto(`/contracts/${ids.contract}`);
  await expect(page.getByText('Pendente de assinatura', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Registrar 1º pagamento em dinheiro' }),
  ).toHaveCount(0);

  await page.getByLabel('Selecionar contrato assinado').setInputFiles({
    name: 'contrato-assinado.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 contrato assinado'),
  });

  await expect.poll(() => usedDocumentMultipartField).toBe(true);
  await expect(page.getByText(/Documento assinado anexado/)).toBeVisible();
  await expect(page.getByText('Pagamento pendente', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Registrar 1º pagamento em dinheiro' }).click();
  const dialog = page.getByRole('dialog', { name: 'Registrar pagamento em dinheiro' });
  await expect(dialog.getByLabel('Valor recebido')).toHaveValue('1.500,00');

  const popupPromise = page.waitForEvent('popup');
  await dialog.getByRole('button', { name: 'Confirmar recebimento' }).click();
  const receiptPopup = await popupPromise;

  await expect.poll(() => settledAmount).toBe(150_000);
  await expect.poll(() => receiptDownloaded).toBe(true);
  await expect(dialog.getByText('Pagamento registrado e recibo emitido.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Concluir' }).click();
  await expect(page.getByText('Ativo', { exact: true })).toBeVisible();
  await receiptPopup.close();
});
