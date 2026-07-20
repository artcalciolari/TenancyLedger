import { expect, test, type Page, type Route } from '@playwright/test';

const ids = {
  user: '10000000-0000-4000-8000-000000000001',
  draft: '90000000-0000-4000-8000-000000000001',
  property: '30000000-0000-4000-8000-000000000001',
  tenant: '20000000-0000-4000-8000-000000000001',
  contract: '40000000-0000-4000-8000-000000000001',
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
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.ipad-signature`;
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

interface ExistingDraft {
  payload: unknown;
  hasPhoto: boolean;
}

async function mockWizardApi(page: Page, existingDraft?: ExistingDraft) {
  let draftPayload: unknown = existingDraft?.payload ?? null;
  let hasPhoto = existingDraft?.hasPhoto ?? false;
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
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (!path.startsWith('/api/')) return route.continue();
    if (path === '/api/onboarding-drafts' && request.method() === 'GET') {
      if (!existingDraft) return json(route, { data: [] });
      return json(route, {
        data: [
          {
            id: ids.draft,
            payload: draftPayload,
            status: 'DRAFT',
            hasPhoto,
            createdAt: '2026-07-18T12:00:00.000Z',
            updatedAt: '2026-07-18T12:10:00.000Z',
          },
        ],
      });
    }
    if (path === '/api/onboarding-drafts' && request.method() === 'POST') {
      draftPayload = (request.postDataJSON() as { payload: unknown }).payload;
      return json(
        route,
        {
          id: ids.draft,
          payload: draftPayload,
          status: 'DRAFT',
          createdAt: '2026-07-18T12:00:00.000Z',
          updatedAt: '2026-07-18T12:00:00.000Z',
        },
        201,
      );
    }
    if (path === `/api/onboarding-drafts/${ids.draft}` && request.method() === 'PATCH') {
      draftPayload = (request.postDataJSON() as { payload: unknown }).payload;
      return json(route, {
        id: ids.draft,
        payload: draftPayload,
        status: 'DRAFT',
        createdAt: '2026-07-18T12:00:00.000Z',
        updatedAt: '2026-07-18T12:10:00.000Z',
      });
    }
    if (path === `/api/onboarding-drafts/${ids.draft}/complete` && request.method() === 'POST') {
      return json(route, {
        draftId: ids.draft,
        tenantId: ids.tenant,
        contractId: ids.contract,
        status: 'COMPLETED',
      });
    }
    if (path === `/api/onboarding-drafts/${ids.draft}/photo`) {
      if (request.method() === 'POST') {
        hasPhoto = true;
        return route.fulfill({ status: 204 });
      }
      if (request.method() === 'DELETE') {
        hasPhoto = false;
        return route.fulfill({ status: 204 });
      }
    }
    if (
      path === `/api/onboarding-drafts/${ids.draft}/photo/download` &&
      request.method() === 'GET'
    ) {
      return json(route, {
        url: 'https://storage.example.test/onboarding-draft-photo.jpg',
        expiresInSeconds: 300,
      });
    }
    if (path === '/api/properties/available') {
      return json(route, [
        {
          id: ids.property,
          neighborhood: 'Centro',
          type: 'ROOM',
          unitNumber: '12-B',
          buildingId: null,
          buildingName: 'Residencial Aurora',
          occupied: false,
          createdAt: '2026-01-01T12:00:00.000Z',
        },
      ]);
    }
    if (path === '/api/notifications') {
      return json(route, {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        unreadCount: 0,
      });
    }
    if (path === `/api/contracts/${ids.contract}`) {
      return json(route, {
        id: ids.contract,
        tenantId: ids.tenant,
        propertyUnitId: ids.property,
        moveInDate: '2026-07-18',
        endDate: '2027-07-17',
        monthlyBaseValueCents: 150000,
        durationInMonths: 12,
        isRenewable: true,
        billingDay: 18,
        status: 'ACTIVE',
        createdAt: '2026-07-18T12:00:00.000Z',
        updatedAt: '2026-07-18T12:00:00.000Z',
      });
    }
    return json(route, { title: 'Not mocked', status: 404 }, 404);
  });
  return () => draftPayload;
}

test('conclui o wizard presencial no projeto iPad', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'ipad', 'Cenário dedicado ao viewport iPad landscape.');
  const readDraftPayload = await mockWizardApi(page);
  await page.goto('/onboarding');

  await expect(page.getByRole('heading', { name: 'Dados pessoais' })).toBeVisible();
  await page.getByLabel('Nome completo').fill('Marina Oliveira');
  await page.getByLabel('CPF').fill('52998224725');
  await page.getByLabel('RG').fill('123456789');
  await page.getByLabel('Profissão').fill('Enfermeira');
  await page.getByLabel('E-mail').fill('marina@example.test');
  await page.getByLabel('Celular').fill('11999999999');
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.getByRole('button', { name: 'Adicionar foto depois' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  const names = page.getByLabel('Nome', { exact: true });
  const relationships = page.getByLabel('Relação com o locatário');
  const phones = page.getByLabel('Telefone');
  await names.nth(0).fill('Joana Oliveira');
  await relationships.nth(0).fill('Irmã');
  await phones.nth(0).fill('11988888888');
  await names.nth(1).fill('Carlos Souza');
  await relationships.nth(1).fill('Colega de trabalho');
  await phones.nth(1).fill('11977777777');
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByRole('heading', { name: 'Escolha o quarto' })).toBeVisible();
  await page.getByLabel('Data de entrada').fill('2026-07-18');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await page.getByRole('radio').click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.getByLabel('Valor mensal').fill('1.500,00');
  await expect(page.getByText(/18\/07\/2026 a 17\/08\/2026/)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot('review-ipad.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.001,
    scale: 'css',
  });
  await page.getByRole('button', { name: 'Concluir cadastro' }).click();

  await expect(page).toHaveURL(`/contracts/${ids.contract}`);
  await expect.poll(readDraftPayload).toMatchObject({
    personalData: { name: 'Marina Oliveira' },
    propertyUnitId: ids.property,
    monthlyBaseValueCents: 150000,
  });
});

test('retoma um rascunho com foto persistida sem exigir nova seleção', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'ipad', 'Cenário dedicado ao viewport iPad landscape.');
  await mockWizardApi(page, {
    hasPhoto: true,
    payload: {
      version: 1,
      personalData: {
        name: 'Marina Oliveira',
        cpf: '52998224725',
        rg: '123456789',
        profession: 'Enfermeira',
        civilStatus: 'SINGLE',
        email: 'marina@example.test',
        mobilePhone: '11999999999',
      },
      photo: { name: 'marina.jpg', type: 'image/jpeg', size: 20_000, skipped: false },
      references: [
        { name: 'Joana Oliveira', relationship: 'Irmã', phone: '11988888888' },
        { name: 'Carlos Souza', relationship: 'Colega', phone: '11977777777' },
      ],
      propertyUnitId: null,
      moveInDate: '2026-07-18',
      monthlyBaseValueCents: null,
    },
  });
  await page.goto('/onboarding');

  await page.getByRole('button', { name: 'Retomar' }).click();
  await expect(page.getByText('Rascunho retomado.')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByRole('heading', { name: 'Foto do locatário' })).toBeVisible();
  await expect(page.getByText('Foto salva no rascunho.')).toBeVisible();
  await expect(page.getByText(/o arquivo precisa ser selecionado novamente/)).not.toBeVisible();

  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Referências' })).toBeVisible();
});
