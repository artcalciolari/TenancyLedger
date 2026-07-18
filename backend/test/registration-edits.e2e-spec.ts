import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { AuditLog } from '../src/core/infrastructure/audit/audit-log.entity';

type JsonRecord = Record<string, unknown>;

interface CreatedBuilding {
  id: string;
  name: string;
  neighborhood: string;
}

interface CreatedProperty {
  id: string;
  unitNumber: string;
  neighborhood: string;
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

    const dataSource = nestApp.get(DataSource);
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

  async function createProperty(
    building: CreatedBuilding,
    label: string,
    type = 'APARTMENT',
  ): Promise<CreatedProperty> {
    const unitNumber = `${label}-${suffix}`;
    const response = await request(httpServer())
      .post('/properties')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ buildingId: building.id, type, unitNumber })
      .expect(201);
    return {
      id: readString(asRecord(responseBody(response)), 'id'),
      unitNumber,
      neighborhood: building.neighborhood,
    };
  }

  async function createStandaloneProperty(
    label: string,
    neighborhood = `Bairro avulso ${label} ${suffix}`,
  ): Promise<CreatedProperty> {
    const unitNumber = `${label}-${suffix}`;
    const response = await request(httpServer())
      .post('/properties')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ neighborhood, type: 'HOUSE', unitNumber })
      .expect(201);
    return {
      id: readString(asRecord(responseBody(response)), 'id'),
      unitNumber,
      neighborhood,
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

  it('renames a building and propagates its neighborhood to linked units', async () => {
    const building = await createBuilding('propagação');
    const property = await createProperty(building, 'PROP');
    const updatedName = `Prédio atualizado ${suffix}`;
    const updatedNeighborhood = `Bairro atualizado ${suffix}`;

    const response = await authorizedPatch(`/buildings/${building.id}`)
      .send({ name: updatedName, neighborhood: updatedNeighborhood })
      .expect(200);
    const updated = asRecord(responseBody(response));
    const units = asArray(updated.units, 'updated building units').map((unit) =>
      asRecord(unit, 'building unit'),
    );

    expect(updated).toMatchObject({
      id: building.id,
      name: updatedName,
      neighborhood: updatedNeighborhood,
      totalUnits: 1,
    });
    expect(units).toContainEqual(
      expect.objectContaining({ id: property.id, neighborhood: updatedNeighborhood }),
    );

    const propertyResponse = await request(httpServer())
      .get(`/properties/${property.id}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(asRecord(responseBody(propertyResponse))).toMatchObject({
      id: property.id,
      neighborhood: updatedNeighborhood,
      buildingId: building.id,
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

  it('updates only the building address without propagating an unchanged neighborhood', async () => {
    const building = await createBuilding('sem propagação');
    const property = await createProperty(building, 'NO-PROPAGATION');

    const response = await authorizedPatch(`/buildings/${building.id}`)
      .send({ address: '   ' })
      .expect(200);

    expect(asRecord(responseBody(response))).toMatchObject({
      id: building.id,
      name: building.name,
      neighborhood: building.neighborhood,
      address: null,
    });
    const propertyResponse = await request(httpServer())
      .get(`/properties/${property.id}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(asRecord(responseBody(propertyResponse))).toMatchObject({
      id: property.id,
      neighborhood: building.neighborhood,
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

  it('edits the type and number of a property linked to a building', async () => {
    const building = await createBuilding('edição unidade');
    const property = await createProperty(building, 'EDIT');
    const unitNumber = `EDITADA-${suffix}`;

    const response = await authorizedPatch(`/properties/${property.id}`)
      .send({ type: 'COMMERCIAL', unitNumber })
      .expect(200);

    expect(asRecord(responseBody(response))).toMatchObject({
      id: property.id,
      buildingId: building.id,
      neighborhood: building.neighborhood,
      type: 'COMMERCIAL',
      unitNumber,
    });
  });

  it('returns 422 when changing the building link of a property', async () => {
    const building = await createBuilding('vínculo original');
    const otherBuilding = await createBuilding('vínculo novo');
    const property = await createProperty(building, 'LINK');
    const requestId = `e2e-property-building-${suffix}`;

    const response = await authorizedPatch(`/properties/${property.id}`)
      .set('x-request-id', requestId)
      .send({ buildingId: otherBuilding.id })
      .expect('content-type', /application\/problem\+json/)
      .expect(422);

    expectProblem(response, 422, requestId, 'O vínculo da unidade com o prédio é imutável.');
  });

  it('returns 422 when changing the derived neighborhood of a linked property', async () => {
    const building = await createBuilding('bairro derivado');
    const property = await createProperty(building, 'NEIGHBORHOOD');
    const requestId = `e2e-property-neighborhood-${suffix}`;

    const response = await authorizedPatch(`/properties/${property.id}`)
      .set('x-request-id', requestId)
      .send({ neighborhood: `Outro bairro ${suffix}` })
      .expect('content-type', /application\/problem\+json/)
      .expect(422);

    expectProblem(
      response,
      422,
      requestId,
      'O bairro de uma unidade vinculada é definido pelo prédio.',
    );
  });

  it('returns 409 when a property number duplicates another unit in the building', async () => {
    const building = await createBuilding('unidades duplicadas');
    const target = await createProperty(building, 'UNIT-A');
    const source = await createProperty(building, 'UNIT-B');
    const requestId = `e2e-property-conflict-${suffix}`;

    const response = await authorizedPatch(`/properties/${source.id}`)
      .set('x-request-id', requestId)
      .send({ unitNumber: target.unitNumber.toLowerCase() })
      .expect('content-type', /application\/problem\+json/)
      .expect(409);

    expectProblem(response, 409, requestId, 'Já existe uma unidade com este número neste prédio.');
  });

  it('returns 404 when editing a missing property', async () => {
    const requestId = `e2e-property-not-found-${suffix}`;

    const response = await authorizedPatch(`/properties/${randomUUID()}`)
      .set('x-request-id', requestId)
      .send({ type: 'ROOM' })
      .expect('content-type', /application\/problem\+json/)
      .expect(404);

    expectProblem(response, 404, requestId, 'Unidade imobiliária não encontrada.');
  });

  it('edits the neighborhood of a standalone property', async () => {
    const property = await createStandaloneProperty('STANDALONE-EDIT');
    const neighborhood = `Novo bairro avulso ${suffix}`;

    const response = await authorizedPatch(`/properties/${property.id}`)
      .send({ neighborhood })
      .expect(200);

    expect(asRecord(responseBody(response))).toMatchObject({
      id: property.id,
      neighborhood,
      unitNumber: property.unitNumber,
      buildingId: null,
      buildingName: null,
    });
  });

  it('returns 409 when a standalone property edit duplicates a normalized location', async () => {
    const neighborhood = `Bairro conflito avulso ${suffix}`;
    const target = await createStandaloneProperty('STANDALONE-A', neighborhood);
    const source = await createStandaloneProperty('STANDALONE-B', neighborhood);
    const requestId = `e2e-property-location-conflict-${suffix}`;

    const response = await authorizedPatch(`/properties/${source.id}`)
      .set('x-request-id', requestId)
      .send({ unitNumber: target.unitNumber.toLowerCase() })
      .expect('content-type', /application\/problem\+json/)
      .expect(409);

    expectProblem(response, 409, requestId, 'Já existe uma unidade com este bairro e número.');
  });

  it('returns 422 when a property number normalizes to blank text', async () => {
    const property = await createStandaloneProperty('BLANK-UNIT');
    const requestId = `e2e-property-blank-${suffix}`;

    const response = await authorizedPatch(`/properties/${property.id}`)
      .set('x-request-id', requestId)
      .send({ unitNumber: '   ' })
      .expect('content-type', /application\/problem\+json/)
      .expect(422);

    expectProblem(response, 422, requestId, 'O número da unidade é obrigatório.');
  });

  it('returns 422 when a property edit carries an invalid nullable type', async () => {
    const property = await createStandaloneProperty('NULL-TYPE');
    const requestId = `e2e-property-null-type-${suffix}`;

    const response = await authorizedPatch(`/properties/${property.id}`)
      .set('x-request-id', requestId)
      .send({ type: null })
      .expect('content-type', /application\/problem\+json/)
      .expect(422);

    expectProblem(response, 422, requestId, 'O tipo da unidade é inválido.');
  });

  it('rejects property creation with a missing building or duplicate unit number', async () => {
    const missingRequestId = `e2e-property-create-building-${suffix}`;
    const missingResponse = await request(httpServer())
      .post('/properties')
      .set('authorization', `Bearer ${adminToken}`)
      .set('x-request-id', missingRequestId)
      .send({
        buildingId: randomUUID(),
        type: 'APARTMENT',
        unitNumber: `MISSING-${suffix}`,
      })
      .expect('content-type', /application\/problem\+json/)
      .expect(404);
    expectProblem(missingResponse, 404, missingRequestId, 'Prédio não encontrado.');

    const building = await createBuilding('duplicidade de criação');
    const existing = await createProperty(building, 'CREATE-DUPLICATE');
    const duplicateRequestId = `e2e-property-create-conflict-${suffix}`;
    const duplicateResponse = await request(httpServer())
      .post('/properties')
      .set('authorization', `Bearer ${adminToken}`)
      .set('x-request-id', duplicateRequestId)
      .send({
        buildingId: building.id,
        type: 'ROOM',
        unitNumber: existing.unitNumber.toLowerCase(),
      })
      .expect('content-type', /application\/problem\+json/)
      .expect(409);
    expectProblem(
      duplicateResponse,
      409,
      duplicateRequestId,
      'Já existe uma unidade com este número neste prédio.',
    );
  });

  it('returns 404 when getting missing building and property resources', async () => {
    const buildingRequestId = `e2e-building-get-not-found-${suffix}`;
    const buildingResponse = await request(httpServer())
      .get(`/buildings/${randomUUID()}`)
      .set('authorization', `Bearer ${adminToken}`)
      .set('x-request-id', buildingRequestId)
      .expect('content-type', /application\/problem\+json/)
      .expect(404);
    expectProblem(buildingResponse, 404, buildingRequestId, 'Prédio não encontrado.');

    const propertyRequestId = `e2e-property-get-not-found-${suffix}`;
    const propertyResponse = await request(httpServer())
      .get(`/properties/${randomUUID()}`)
      .set('authorization', `Bearer ${adminToken}`)
      .set('x-request-id', propertyRequestId)
      .expect('content-type', /application\/problem\+json/)
      .expect(404);
    expectProblem(propertyResponse, 404, propertyRequestId, 'Unidade imobiliária não encontrada.');
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
});
