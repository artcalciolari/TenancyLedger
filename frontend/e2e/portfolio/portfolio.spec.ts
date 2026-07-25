import { expect, test, type Page, type Route } from '@playwright/test';

const ids = {
  user: '10000000-0000-4000-8000-000000000011',
  buildingA: '30000000-0000-4000-8000-000000000011',
  buildingB: '30000000-0000-4000-8000-000000000012',
  roomA: '40000000-0000-4000-8000-000000000011',
  roomB: '40000000-0000-4000-8000-000000000012',
  createdRoom: '40000000-0000-4000-8000-000000000099',
} as const;

interface MockBuilding {
  id: string;
  name: string;
  neighborhood: string;
  address: string | null;
  createdAt: string;
  totalRooms: number;
  occupiedRooms: number;
  vacantRooms: number;
  vacancyPercentage: number | null;
}

interface MockRoom {
  id: string;
  buildingId: string;
  number: string;
  createdAt: string;
  buildingName: string;
  buildingNeighborhood: string;
  buildingAddress: string | null;
  occupied: boolean;
}

function accessToken(): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: ids.user,
      email: 'portfolio@example.test',
      role: 'MANAGER',
      exp: 4_102_444_800,
    }),
  ).toString('base64url');
  return `test.${payload}.signature`;
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockPortfolioApi(page: Page) {
  const buildings: MockBuilding[] = [
    {
      id: ids.buildingA,
      name: 'Edifício Aurora',
      neighborhood: 'Centro',
      address: 'Rua das Flores, 10',
      createdAt: '2026-07-20T12:00:00.000Z',
      totalRooms: 2,
      occupiedRooms: 1,
      vacantRooms: 1,
      vacancyPercentage: 50,
    },
    {
      id: ids.buildingB,
      name: 'Residencial Brisa',
      neighborhood: 'Jardins',
      address: null,
      createdAt: '2026-07-21T12:00:00.000Z',
      totalRooms: 0,
      occupiedRooms: 0,
      vacantRooms: 0,
      vacancyPercentage: null,
    },
  ];
  const rooms: MockRoom[] = [
    {
      id: ids.roomA,
      buildingId: ids.buildingA,
      number: '101',
      createdAt: '2026-07-20T12:00:00.000Z',
      buildingName: 'Edifício Aurora',
      buildingNeighborhood: 'Centro',
      buildingAddress: 'Rua das Flores, 10',
      occupied: false,
    },
    {
      id: ids.roomB,
      buildingId: ids.buildingA,
      number: '102',
      createdAt: '2026-07-20T12:10:00.000Z',
      buildingName: 'Edifício Aurora',
      buildingNeighborhood: 'Centro',
      buildingAddress: 'Rua das Flores, 10',
      occupied: true,
    },
  ];
  const lastCreatedRoomId = ids.createdRoom;
  let postedRoomBody: unknown;

  await page.addInitScript(
    ({ token, userId }) => {
      sessionStorage.setItem(
        'tenancy-ledger:session:v1',
        JSON.stringify({
          accessToken: token,
          user: {
            id: userId,
            email: 'portfolio@example.test',
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

    if (path === '/api/notifications') {
      return json(route, {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        unreadCount: 0,
      });
    }

    if (path === '/api/dashboard/summary') {
      return json(route, {
        contracts: { active: 1, endingSoon: 0, overdue: 0 },
        invoices: { open: 0, overdue: 0, underReview: 0 },
        payments: { submitted: 0 },
        cashbox: { openDays: 0 },
      });
    }

    if (path === '/api/buildings' && request.method() === 'GET') {
      const query = url.searchParams;
      const q = query.get('q')?.toLowerCase() ?? '';
      const vacancy = query.get('vacancy');
      const filtered = buildings.filter((building) => {
        const matchesQ =
          q === '' ||
          [building.name, building.neighborhood, building.address ?? '']
            .join(' ')
            .toLowerCase()
            .includes(q);
        const matchesVacancy =
          vacancy === 'WITH_VACANCY'
            ? building.vacantRooms > 0
            : vacancy === 'FULL'
              ? building.totalRooms > 0 && building.vacantRooms === 0
              : vacancy === 'NO_ROOMS'
                ? building.totalRooms === 0
                : true;
        return matchesQ && matchesVacancy;
      });
      return json(route, {
        data: filtered,
        meta: { page: 1, limit: 100, total: filtered.length, totalPages: 1 },
      });
    }

    if (/^\/api\/buildings\/[0-9a-f-]{36}$/i.test(path) && request.method() === 'GET') {
      const buildingId = path.split('/').at(-1)!;
      const building = buildings.find((entry) => entry.id === buildingId);
      if (!building) return json(route, { title: 'Not found', status: 404 }, 404);
      return json(route, {
        ...building,
        rooms: rooms
          .filter((room) => room.buildingId === buildingId)
          .map(({ id, number, occupied }) => ({ id, number, occupied })),
      });
    }

    if (path === '/api/rooms' && request.method() === 'GET') {
      const query = url.searchParams;
      const q = query.get('q')?.toLowerCase() ?? '';
      const buildingId = query.get('buildingId');
      const status = query.get('status');
      const filtered = rooms.filter((room) => {
        const matchesQ =
          q === '' ||
          [room.number, room.buildingName, room.buildingNeighborhood, room.buildingAddress ?? '']
            .join(' ')
            .toLowerCase()
            .includes(q);
        const matchesBuilding = !buildingId || room.buildingId === buildingId;
        const matchesStatus =
          status === 'VACANT' ? !room.occupied : status === 'OCCUPIED' ? room.occupied : true;
        return matchesQ && matchesBuilding && matchesStatus;
      });
      return json(route, {
        data: filtered,
        meta: { page: 1, limit: 100, total: filtered.length, totalPages: 1 },
      });
    }

    if (path === '/api/rooms' && request.method() === 'POST') {
      const input = request.postDataJSON() as { buildingId: string; number: string };
      postedRoomBody = input;
      const building = buildings.find((entry) => entry.id === input.buildingId);
      if (!building) return json(route, { title: 'Not found', status: 404 }, 404);
      rooms.push({
        id: lastCreatedRoomId,
        buildingId: input.buildingId,
        number: input.number,
        createdAt: '2026-07-24T12:00:00.000Z',
        buildingName: building.name,
        buildingNeighborhood: building.neighborhood,
        buildingAddress: building.address,
        occupied: false,
      });
      building.totalRooms += 1;
      building.vacantRooms += 1;
      building.vacancyPercentage =
        Math.round((building.vacantRooms / building.totalRooms) * 1000) / 10;
      return json(
        route,
        rooms.find((room) => room.id === lastCreatedRoomId),
        201,
      );
    }

    if (/^\/api\/rooms\/[0-9a-f-]{36}$/i.test(path) && request.method() === 'GET') {
      const roomId = path.split('/').at(-1)!;
      const room = rooms.find((entry) => entry.id === roomId);
      if (!room) return json(route, { title: 'Not found', status: 404 }, 404);
      return json(route, room);
    }

    return json(route, { title: 'Not mocked', status: 404 }, 404);
  });

  return {
    readPostedRoomBody: () => postedRoomBody,
  };
}

test('preserva abas e filtros do portfólio na URL após alternar e recarregar', async ({ page }) => {
  await mockPortfolioApi(page);
  await page.goto('/portfolio');

  await expect(page.getByRole('tab', { name: 'Prédios', selected: true })).toBeVisible();
  await page.getByLabel('Buscar prédio').fill('Aurora');
  await page.getByLabel('Data de referência').fill('2026-08-01');
  await page.getByLabel('Vacância').click();
  await page.getByRole('option', { name: 'Com vagas' }).click();
  await page.getByRole('button', { name: 'Aplicar' }).click();

  await expect(page).toHaveURL(/buildingsQ=Aurora/);
  await expect(page).toHaveURL(/buildingVacancy=WITH_VACANCY/);
  await expect(page).toHaveURL(/date=2026-08-01/);

  await page.getByRole('tab', { name: 'Quartos' }).click();
  await expect(page.getByRole('tab', { name: 'Quartos', selected: true })).toBeVisible();
  await expect(page.getByLabel('Data de referência')).toHaveValue('2026-08-01');
  await page.getByLabel('Buscar quarto').fill('101');
  await page.getByLabel('Prédio').click();
  await page.getByRole('option', { name: 'Edifício Aurora' }).click();
  await page.getByLabel('Situação').click();
  await page.getByRole('option', { name: 'Vago' }).click();
  await page.getByRole('button', { name: 'Aplicar' }).click();

  await expect(page).toHaveURL(/tab=rooms/);
  await expect(page).toHaveURL(/roomsQ=101/);
  await expect(page).toHaveURL(new RegExp(`roomBuildingId=${ids.buildingA}`));
  await expect(page).toHaveURL(/roomStatus=VACANT/);
  await expect(page).toHaveURL(/buildingsQ=Aurora/);

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Quartos', selected: true })).toBeVisible();
  await expect(page.getByLabel('Buscar quarto')).toHaveValue('101');
  await expect(page.getByLabel('Data de referência')).toHaveValue('2026-08-01');

  await page.getByRole('tab', { name: 'Prédios' }).click();
  await expect(page.getByLabel('Buscar prédio')).toHaveValue('Aurora');
  await expect(page.getByRole('combobox', { name: 'Vacância' })).toHaveText('Com vagas');
  await expect(page.getByLabel('Data de referência')).toHaveValue('2026-08-01');
});

test('cadastra quarto a partir do detalhe do prédio com vínculo travado', async ({ page }) => {
  const api = await mockPortfolioApi(page);
  await page.goto('/portfolio');

  await page
    .getByRole('link', { name: 'Edifício Aurora' })
    .or(page.getByRole('link', { name: 'Ver detalhes' }).first())
    .click();
  await expect(page).toHaveURL(new RegExp(`/buildings/${ids.buildingA}(?:\\?|$)`));
  await page.getByRole('link', { name: 'Adicionar quarto' }).click();

  await expect(page).toHaveURL(new RegExp(`/rooms/new\\?buildingId=${ids.buildingA}`));
  await expect(page.getByRole('combobox', { name: 'Prédio' })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Prédio' })).toHaveText('Edifício Aurora');
  await page.getByLabel('Número do quarto').fill('103');
  await page.getByRole('button', { name: 'Cadastrar quarto' }).click();

  expect(api.readPostedRoomBody()).toMatchObject({ buildingId: ids.buildingA, number: '103' });
  await expect(page).toHaveURL(`/rooms/${ids.createdRoom}`);
  await expect(page.getByRole('link', { name: 'Edifício Aurora' })).toBeVisible();
});

test.describe('responsividade do portfólio', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('renderiza cartões nas abas de prédios e quartos em mobile', async ({ page }) => {
    await mockPortfolioApi(page);
    await page.goto('/portfolio?tab=rooms');

    await expect(page.getByRole('tab', { name: 'Quartos', selected: true })).toBeVisible();
    await expect(page.getByText('Quarto 101')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver detalhes' }).first()).toBeVisible();

    await page.getByRole('tab', { name: 'Prédios' }).click();
    await expect(page.getByText('Edifício Aurora').first()).toBeVisible();
    await expect(page.getByText(/Sem quartos/).first()).toBeVisible();
  });
});
