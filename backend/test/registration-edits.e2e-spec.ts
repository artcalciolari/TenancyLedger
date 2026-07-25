import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Contract } from '../src/contexts/contract/domain/entities/contract.entity';
import { AuditLog } from '../src/core/infrastructure/audit/audit-log.entity';

type JsonRecord = Record<string, unknown>;

interface CreatedBuilding {
  id: string;
  name: string;
  neighborhood: string;
}

interface CreatedRoom {
  id: string;
  number: string;
  buildingId: string;
}

interface TenantInput {
  name: string;
  cpf: string;
  rg: string;
  profession: string;
  civilStatus: 'SINGLE';
  email: string;
  mobilePhone: string;
}

interface CreatedTenant {
  id: string;
  input: TenantInput;
}

function asRecord(value: unknown, description = 'JSON response'): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${description} must be an object`);
  }
  return value as JsonRecord;
}

function asArray(value: unknown, description: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${description} must be an array`);
  return value;
}

function readString(record: JsonRecord, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') throw new TypeError(`${key} must be a string`);
  return value;
}

function responseBody(response: request.Response): unknown {
  return response.body as unknown;
}

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}-${process.pid.toString(36)}-${randomUUID().slice(0, 8)}`;
}

function calculateCpfCheckDigit(base: string): string {
  let factor = base.length + 1;
  const total = [...base].reduce((sum, digit) => sum + Number(digit) * factor--, 0);
  const remainder = (total * 10) % 11;
  return String(remainder === 10 ? 0 : remainder);
}

function validCpf(): string {
  const nineDigits = randomUUID().replace(/\D/g, '').padEnd(9, '7').slice(0, 9);
  const firstDigit = calculateCpfCheckDigit(nineDigits);
  return `${nineDigits}${firstDigit}${calculateCpfCheckDigit(`${nineDigits}${firstDigit}`)}`;
}

function formatCpf(cpf: string): string {
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

function uniqueMobilePhone(): string {
  const subscriber = randomUUID().replace(/\D/g, '').padEnd(8, '7').slice(0, 8);
  return `+55 11 9${subscriber.slice(0, 4)}-${subscriber.slice(4)}`;
}

function normalizedPhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 13 && digits.startsWith('55') ? digits.slice(2) : digits;
}

describe('Registration edits (e2e)', () => {
  jest.setTimeout(120_000);

  let app: INestApplication | undefined;
  let dataSource: DataSource;
  let auditLogs: Repository<AuditLog>;
  let adminToken = '';
  let adminId = '';

  const suffix = uniqueSuffix();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const nestApp = moduleFixture.createNestApplication();
    app = nestApp;
    configureApp(nestApp);
    await nestApp.init();

    dataSource = nestApp.get(DataSource);
    auditLogs = dataSource.getRepository(AuditLog);

    const email = process.env.AUTH_BOOTSTRAP_EMAIL ?? 'admin@example.com';
    const password = process.env.AUTH_BOOTSTRAP_PASSWORD ?? 'ChangeMeNow123!';
    const loginResponse = await request(httpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    const login = asRecord(responseBody(loginResponse));
    adminToken = readString(login, 'accessToken');
    adminId = readString(asRecord(login.user, 'authenticated user'), 'id');
  });

  afterAll(async () => {
    await app?.close();
  });

  function httpServer(): App {
    if (!app) throw new Error('E2E application was not initialized');
    return app.getHttpServer() as App;
  }

  function authorizedPatch(path: string): request.Test {
    return request(httpServer()).patch(path).set('authorization', `Bearer ${adminToken}`);
  }

  async function createBuilding(label: string): Promise<CreatedBuilding> {
    const name = `Prédio ${label} ${suffix}`;
    const neighborhood = `Bairro ${label} ${suffix}`;
    const response = await request(httpServer())
      .post('/buildings')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ name, neighborhood, address: `Rua ${label}, 10` })
      .expect(201);
    return { id: readString(asRecord(responseBody(response)), 'id'), name, neighborhood };
  }

  async function createRoom(building: CreatedBuilding, label: string): Promise<CreatedRoom> {
    const number = `${label}-${suffix}`;
    const response = await request(httpServer())
      .post('/rooms')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ buildingId: building.id, number })
      .expect(201);
    return {
      id: readString(asRecord(responseBody(response)), 'id'),
      number,
      buildingId: building.id,
    };
  }

  async function createTenant(label: string): Promise<CreatedTenant> {
    const cpf = validCpf();
    const emailLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const input: TenantInput = {
      name: `Locatário ${label} ${suffix}`,
      cpf: formatCpf(cpf),
      rg: `RG${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
      profession: 'Analista de sistemas',
      civilStatus: 'SINGLE',
      email: `${emailLabel}.${suffix}@example.test`,
      mobilePhone: uniqueMobilePhone(),
    };
    const response = await request(httpServer())
      .post('/tenants')
      .set('authorization', `Bearer ${adminToken}`)
      .send(input)
      .expect(201);
    return { id: readString(asRecord(responseBody(response)), 'id'), input };
  }

  function expectProblem(
    response: request.Response,
    status: number,
    requestId: string,
    detail: string,
  ): void {
    expect(asRecord(responseBody(response))).toMatchObject({ status, requestId, detail });
  }

  it('renames a building and its rooms reflect the updated name and neighborhood', async () => {
    const building = await createBuilding('propagação');
    const room = await createRoom(building, 'PROP');
    const updatedName = `Prédio atualizado ${suffix}`;
    const updatedNeighborhood = `Bairro atualizado ${suffix}`;

    const response = await authorizedPatch(`/buildings/${building.id}`)
      .send({ name: updatedName, neighborhood: updatedNeighborhood })
      .expect(200);
    const updated = asRecord(responseBody(response));
    const rooms = asArray(updated.rooms, 'updated building rooms').map((entry) =>
      asRecord(entry, 'building room'),
    );

    expect(updated).toMatchObject({
      id: building.id,
      name: updatedName,
      neighborhood: updatedNeighborhood,
      totalRooms: 1,
    });
    expect(rooms).toContainEqual(expect.objectContaining({ id: room.id, number: room.number }));

    const roomResponse = await request(httpServer())
      .get(`/rooms/${room.id}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(asRecord(responseBody(roomResponse))).toMatchObject({
      id: room.id,
      buildingId: building.id,
      buildingName: updatedName,
    });
  });

  it('returns 404 when editing a missing building', async () => {
    const requestId = `e2e-building-not-found-${suffix}`;
    const response = await authorizedPatch(`/buildings/${randomUUID()}`)
      .set('x-request-id', requestId)
      .send({ name: `Prédio ausente ${suffix}` })
      .expect('content-type', /application\/problem\+json/)
      .expect(404);

    expectProblem(response, 404, requestId, 'Prédio não encontrado.');
  });

  it('returns 409 when a building name duplicates another name case-insensitively', async () => {
    const source = await createBuilding('origem conflito');
    const target = await createBuilding('destino conflito');
    const requestId = `e2e-building-conflict-${suffix}`;

    const response = await authorizedPatch(`/buildings/${source.id}`)
      .set('x-request-id', requestId)
      .send({ name: target.name.toUpperCase() })
      .expect('content-type', /application\/problem\+json/)
      .expect(409);

    expectProblem(response, 409, requestId, 'Já existe um prédio com este nome.');
  });

  it('returns 409 when creating a building with a normalized duplicate name', async () => {
    const existing = await createBuilding('conflito de criação');
    const requestId = `e2e-building-create-conflict-${suffix}`;

    const response = await request(httpServer())
      .post('/buildings')
      .set('authorization', `Bearer ${adminToken}`)
      .set('x-request-id', requestId)
      .send({
        name: existing.name.toUpperCase(),
        neighborhood: `Outro bairro ${suffix}`,
      })
      .expect('content-type', /application\/problem\+json/)
      .expect(409);

    expectProblem(response, 409, requestId, 'Já existe um prédio com este nome.');
  });

  it('updates only the building address without affecting its rooms', async () => {
    const building = await createBuilding('sem propagação');
    const room = await createRoom(building, 'NO-PROPAGATION');

    const response = await authorizedPatch(`/buildings/${building.id}`)
      .send({ address: '   ' })
      .expect(200);

    expect(asRecord(responseBody(response))).toMatchObject({
      id: building.id,
      name: building.name,
      neighborhood: building.neighborhood,
      address: null,
    });
    const roomResponse = await request(httpServer())
      .get(`/rooms/${room.id}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(asRecord(responseBody(roomResponse))).toMatchObject({
      id: room.id,
      buildingId: building.id,
    });
  });

  it('returns 422 when a building edit normalizes its name to blank text', async () => {
    const building = await createBuilding('nome inválido');
    const requestId = `e2e-building-blank-${suffix}`;

    const response = await authorizedPatch(`/buildings/${building.id}`)
      .set('x-request-id', requestId)
      .send({ name: '   ' })
      .expect('content-type', /application\/problem\+json/)
      .expect(422);

    expectProblem(response, 422, requestId, 'O nome do prédio é obrigatório.');
  });

  it('edits the number of a room linked to a building', async () => {
    const building = await createBuilding('edição quarto');
    const room = await createRoom(building, 'EDIT');
    const number = `EDITADA-${suffix}`;

    const response = await authorizedPatch(`/rooms/${room.id}`).send({ number }).expect(200);

    expect(asRecord(responseBody(response))).toMatchObject({
      id: room.id,
      buildingId: building.id,
      number,
    });
  });

  it('returns 422 when changing the building link of a room', async () => {
    const building = await createBuilding('vínculo original');
    const otherBuilding = await createBuilding('vínculo novo');
    const room = await createRoom(building, 'LINK');
    const requestId = `e2e-room-building-${suffix}`;

    const response = await authorizedPatch(`/rooms/${room.id}`)
      .set('x-request-id', requestId)
      .send({ buildingId: otherBuilding.id })
      .expect('content-type', /application\/problem\+json/)
      .expect(422);

    expectProblem(response, 422, requestId, 'O vínculo do quarto com o prédio é imutável.');
  });

  it('returns 409 when a room number duplicates another room in the building', async () => {
    const building = await createBuilding('quartos duplicados');
    const target = await createRoom(building, 'UNIT-A');
    const source = await createRoom(building, 'UNIT-B');
    const requestId = `e2e-room-conflict-${suffix}`;

    const response = await authorizedPatch(`/rooms/${source.id}`)
      .set('x-request-id', requestId)
      .send({ number: target.number.toLowerCase() })
      .expect('content-type', /application\/problem\+json/)
      .expect(409);

    expectProblem(response, 409, requestId, 'Já existe um quarto com este número neste prédio.');
  });

  it('returns 404 when editing a missing room', async () => {
    const requestId = `e2e-room-not-found-${suffix}`;

    const response = await authorizedPatch(`/rooms/${randomUUID()}`)
      .set('x-request-id', requestId)
      .send({ number: 'X' })
      .expect('content-type', /application\/problem\+json/)
      .expect(404);

    expectProblem(response, 404, requestId, 'Quarto não encontrado.');
  });

  it('returns 422 when a room number normalizes to blank text', async () => {
    const building = await createBuilding('numero em branco');
    const room = await createRoom(building, 'BLANK-UNIT');
    const requestId = `e2e-room-blank-${suffix}`;

    const response = await authorizedPatch(`/rooms/${room.id}`)
      .set('x-request-id', requestId)
      .send({ number: '   ' })
      .expect('content-type', /application\/problem\+json/)
      .expect(422);

    expectProblem(response, 422, requestId, 'O número do quarto é obrigatório.');
  });

  it('rejects room creation with a missing building or duplicate number', async () => {
    const missingRequestId = `e2e-room-create-building-${suffix}`;
    const missingResponse = await request(httpServer())
      .post('/rooms')
      .set('authorization', `Bearer ${adminToken}`)
      .set('x-request-id', missingRequestId)
      .send({
        buildingId: randomUUID(),
        number: `MISSING-${suffix}`,
      })
      .expect('content-type', /application\/problem\+json/)
      .expect(404);
    expectProblem(missingResponse, 404, missingRequestId, 'Prédio não encontrado.');

    const building = await createBuilding('duplicidade de criação');
    const existing = await createRoom(building, 'CREATE-DUPLICATE');
    const duplicateRequestId = `e2e-room-create-conflict-${suffix}`;
    const duplicateResponse = await request(httpServer())
      .post('/rooms')
      .set('authorization', `Bearer ${adminToken}`)
      .set('x-request-id', duplicateRequestId)
      .send({
        buildingId: building.id,
        number: existing.number.toLowerCase(),
      })
      .expect('content-type', /application\/problem\+json/)
      .expect(409);
    expectProblem(
      duplicateResponse,
      409,
      duplicateRequestId,
      'Já existe um quarto com este número neste prédio.',
    );
  });

  it('returns 404 when getting missing building and room resources', async () => {
    const buildingRequestId = `e2e-building-get-not-found-${suffix}`;
    const buildingResponse = await request(httpServer())
      .get(`/buildings/${randomUUID()}`)
      .set('authorization', `Bearer ${adminToken}`)
      .set('x-request-id', buildingRequestId)
      .expect('content-type', /application\/problem\+json/)
      .expect(404);
    expectProblem(buildingResponse, 404, buildingRequestId, 'Prédio não encontrado.');

    const roomRequestId = `e2e-room-get-not-found-${suffix}`;
    const roomResponse = await request(httpServer())
      .get(`/rooms/${randomUUID()}`)
      .set('authorization', `Bearer ${adminToken}`)
      .set('x-request-id', roomRequestId)
      .expect('content-type', /application\/problem\+json/)
      .expect(404);
    expectProblem(roomResponse, 404, roomRequestId, 'Quarto não encontrado.');
  });

  it('lists buildings without a search term and keeps the created building in the page', async () => {
    const building = await createBuilding('listagem sem filtro');

    const response = await request(httpServer())
      .get('/buildings?page=1&limit=100')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const body = asRecord(responseBody(response));
    const buildings = asArray(body.data, 'unfiltered building page').map((entry) =>
      asRecord(entry, 'building'),
    );

    expect(buildings).toContainEqual(
      expect.objectContaining({ id: building.id, name: building.name }),
    );
    expect(asRecord(body.meta, 'building page metadata')).toMatchObject({
      page: 1,
      limit: 100,
    });
  });

  it('edits tenant contact data and records the successful mutation audit', async () => {
    const tenant = await createTenant('contato');
    const requestId = `e2e-tenant-update-${suffix}`;
    const email = `UPDATED.${suffix}@EXAMPLE.TEST`;
    const mobilePhone = uniqueMobilePhone();

    const response = await authorizedPatch(`/tenants/${tenant.id}`)
      .set('x-request-id', requestId)
      .send({ email, mobilePhone })
      .expect(200);
    const updated = asRecord(responseBody(response));

    expect(updated).toMatchObject({
      id: tenant.id,
      email: email.toLowerCase(),
      mobilePhone: normalizedPhoneDigits(mobilePhone),
    });
    expect(updated).not.toHaveProperty('rg');

    const audit = await auditLogs.findOneOrFail({ where: { requestId } });
    expect(audit).toMatchObject({
      actorId: adminId,
      action: 'PATCH /tenants/:id',
      resourceType: 'tenants',
      resourceId: tenant.id,
      requestId,
    });
    expect(audit.metadata).toMatchObject({
      method: 'PATCH',
      path: `/tenants/${tenant.id}`,
      statusCode: 200,
      role: 'ADMIN',
      piiUnmasked: true,
    });
  });

  it('returns 409 when an edited tenant email normalizes to another identity', async () => {
    const target = await createTenant('email destino');
    const source = await createTenant('email origem');
    const requestId = `e2e-tenant-conflict-${suffix}`;

    const response = await authorizedPatch(`/tenants/${source.id}`)
      .set('x-request-id', requestId)
      .send({ email: target.input.email.toUpperCase() })
      .expect('content-type', /application\/problem\+json/)
      .expect(409);

    expectProblem(response, 409, requestId, 'Já existe um locatário com este e-mail ou telefone.');
  });

  it('returns 422 when an edit payload tries to change immutable tenant identity data', async () => {
    const tenant = await createTenant('identidade imutável');
    const requestId = `e2e-tenant-identity-${suffix}`;

    const response = await authorizedPatch(`/tenants/${tenant.id}`)
      .set('x-request-id', requestId)
      .send({ cpf: tenant.input.cpf })
      .expect('content-type', /application\/problem\+json/)
      .expect(422);

    expectProblem(response, 422, requestId, 'CPF e RG são imutáveis.');
  });

  it('returns 404 when editing a missing tenant', async () => {
    const requestId = `e2e-tenant-not-found-${suffix}`;

    const response = await authorizedPatch(`/tenants/${randomUUID()}`)
      .set('x-request-id', requestId)
      .send({ profession: 'Profissão inexistente' })
      .expect('content-type', /application\/problem\+json/)
      .expect(404);

    expectProblem(response, 404, requestId, 'Locatário não encontrado.');
  });

  it('updates selected tenant profile fields while preserving omitted contact data', async () => {
    const tenant = await createTenant('perfil parcial');
    const name = `Locatário atualizado ${suffix}`;

    const response = await authorizedPatch(`/tenants/${tenant.id}`)
      .send({ name, profession: 'Arquiteto de software', civilStatus: 'MARRIED' })
      .expect(200);

    expect(asRecord(responseBody(response))).toMatchObject({
      id: tenant.id,
      name,
      profession: 'Arquiteto de software',
      civilStatus: 'MARRIED',
      email: tenant.input.email,
      mobilePhone: normalizedPhoneDigits(tenant.input.mobilePhone),
    });
  });

  it('returns 409 when an edited tenant phone normalizes to another identity', async () => {
    const target = await createTenant('telefone destino');
    const source = await createTenant('telefone origem');
    const requestId = `e2e-tenant-phone-conflict-${suffix}`;

    const response = await authorizedPatch(`/tenants/${source.id}`)
      .set('x-request-id', requestId)
      .send({ mobilePhone: target.input.mobilePhone })
      .expect('content-type', /application\/problem\+json/)
      .expect(409);

    expectProblem(response, 409, requestId, 'Já existe um locatário com este e-mail ou telefone.');
  });

  it('returns 422 when a phone accepted as Brazilian is not a mobile number', async () => {
    const tenant = await createTenant('telefone fixo');
    const requestId = `e2e-tenant-landline-${suffix}`;

    const response = await authorizedPatch(`/tenants/${tenant.id}`)
      .set('x-request-id', requestId)
      .send({ mobilePhone: '+55 11 2345-6789' })
      .expect('content-type', /application\/problem\+json/)
      .expect(422);

    expectProblem(response, 422, requestId, 'Telefone celular inválido.');
  });

  it('filters room occupancy and building vacancy by civil date and preserves empty-page totals', async () => {
    const asOf = '2026-07-20';
    const futureDate = '2027-07-20';
    const fullBuilding = await createBuilding('disponibilidade lotado');
    const vacancyBuilding = await createBuilding('disponibilidade vagas');
    const emptyBuilding = await createBuilding('disponibilidade vazio');
    const occupiedRoom = await createRoom(fullBuilding, 'OCCUPIED');
    const vacantRoom = await createRoom(vacancyBuilding, 'VACANT');
    const futureRoom = await createRoom(vacancyBuilding, 'FUTURE');
    const cancelledRoom = await createRoom(vacancyBuilding, 'CANCELLED');
    const terminatedRoom = await createRoom(vacancyBuilding, 'TERMINATED');
    const sameNumberInFull = await createRoom(fullBuilding, 'SAME-NUMBER');
    const sameNumberInVacancy = await createRoom(vacancyBuilding, 'SAME-NUMBER');
    const activeTenant = await createTenant('ocupação ativa');
    const futureTenant = await createTenant('ocupação futura');
    const cancelledTenant = await createTenant('ocupação cancelada');
    const terminatedTenant = await createTenant('ocupação encerrada');
    const contracts = dataSource.getRepository(Contract);

    await contracts.save(
      Contract.create(activeTenant.id, occupiedRoom.id, '2026-07-01', 100_000, 24, false),
    );
    await contracts.save(
      Contract.create(activeTenant.id, sameNumberInFull.id, '2026-07-01', 100_000, 24, false),
    );
    await contracts.save(
      Contract.create(futureTenant.id, futureRoom.id, '2027-01-01', 100_000, 24, false),
    );
    const cancelled = Contract.createPendingSignature(
      cancelledTenant.id,
      cancelledRoom.id,
      '2026-01-01',
      100_000,
    );
    cancelled.cancel('Contrato cancelado para teste.');
    await contracts.save(cancelled);
    const terminated = Contract.create(
      terminatedTenant.id,
      terminatedRoom.id,
      '2026-01-01',
      100_000,
      24,
      false,
    );
    terminated.terminate('Contrato encerrado para teste.');
    await contracts.save(terminated);

    const roomIds = async (query: Record<string, string>): Promise<string[]> => {
      const response = await request(httpServer())
        .get('/rooms')
        .query({ page: '1', limit: '100', ...query })
        .set('authorization', `Bearer ${adminToken}`)
        .expect(200);
      return asArray(asRecord(responseBody(response)).data, 'filtered rooms').map((entry) =>
        readString(asRecord(entry, 'room'), 'id'),
      );
    };

    await expect(
      roomIds({ buildingId: fullBuilding.id, status: 'OCCUPIED', date: asOf }),
    ).resolves.toContain(occupiedRoom.id);
    const vacantAtPresent = await roomIds({
      buildingId: vacancyBuilding.id,
      status: 'VACANT',
      date: asOf,
    });
    expect(vacantAtPresent).toEqual(
      expect.arrayContaining([vacantRoom.id, futureRoom.id, cancelledRoom.id, terminatedRoom.id]),
    );
    await expect(
      roomIds({ buildingId: vacancyBuilding.id, status: 'OCCUPIED', date: futureDate }),
    ).resolves.toContain(futureRoom.id);

    const assertBuildingFilter = async (
      building: CreatedBuilding,
      vacancy: 'WITH_VACANCY' | 'FULL' | 'NO_ROOMS',
    ): Promise<void> => {
      const response = await request(httpServer())
        .get('/buildings')
        .query({ page: 1, limit: 10, q: building.name, date: asOf, vacancy })
        .set('authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(
        asArray(asRecord(responseBody(response)).data, `${vacancy} buildings`).map((entry) =>
          readString(asRecord(entry, 'building'), 'id'),
        ),
      ).toContain(building.id);
    };

    await assertBuildingFilter(vacancyBuilding, 'WITH_VACANCY');
    await assertBuildingFilter(fullBuilding, 'FULL');
    await assertBuildingFilter(emptyBuilding, 'NO_ROOMS');

    const emptyPageResponse = await request(httpServer())
      .get('/buildings')
      .query({
        page: 2,
        limit: 1,
        q: vacancyBuilding.name,
        date: asOf,
        vacancy: 'WITH_VACANCY',
      })
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const emptyPage = asRecord(responseBody(emptyPageResponse));
    expect(asArray(emptyPage.data, 'empty building page')).toHaveLength(0);
    expect(asRecord(emptyPage.meta, 'empty building metadata')).toMatchObject({
      page: 2,
      limit: 1,
      total: 1,
      totalPages: 1,
    });

    expect(sameNumberInFull.number).toBe(sameNumberInVacancy.number);
    await expect(
      roomIds({ buildingId: fullBuilding.id, q: sameNumberInFull.number, date: asOf }),
    ).resolves.toContain(sameNumberInFull.id);
    await expect(
      roomIds({ buildingId: vacancyBuilding.id, q: sameNumberInVacancy.number, date: asOf }),
    ).resolves.toContain(sameNumberInVacancy.id);
  });
});
