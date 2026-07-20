import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { User, UserRole } from '../src/contexts/auth/domain/entities/user.entity';
import { Contract } from '../src/contexts/contract/domain/entities/contract.entity';
import { Invoice } from '../src/contexts/invoice/domain/entities/invoice.entity';
import { InvoiceGenerationWorker } from '../src/contexts/invoice/infrastructure/workers/invoice-generation.worker';
import { PropertyUnit, UnitType } from '../src/contexts/property/domain/property-unit.entity';
import { Tenant, TenantCivilStatus } from '../src/contexts/tenant/domain/entities/tenant.entity';
import { AuditLog } from '../src/core/infrastructure/audit/audit-log.entity';

interface TenantInput {
  name: string;
  cpf: string;
  rg: string;
  profession: string;
  civilStatus: 'SINGLE';
  email: string;
  mobilePhone: string;
}

type JsonRecord = Record<string, unknown>;

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

function firstResponseCookie(response: request.Response): string {
  const headers: unknown = response.headers;
  if (typeof headers !== 'object' || headers === null) {
    throw new TypeError('Response headers are unavailable');
  }
  const value: unknown = Reflect.get(headers, 'set-cookie');
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  throw new Error('Response did not set a cookie');
}

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}-${process.pid.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function calculateCpfCheckDigit(base: string): string {
  let factor = base.length + 1;
  const total = [...base].reduce((sum, digit) => sum + Number(digit) * factor--, 0);
  const remainder = (total * 10) % 11;
  return String(remainder === 10 ? 0 : remainder);
}

function validCpf(seed: string): string {
  const nineDigits = seed.replace(/\D/g, '').padStart(9, '0').slice(-9);
  const firstDigit = calculateCpfCheckDigit(nineDigits);
  return `${nineDigits}${firstDigit}${calculateCpfCheckDigit(`${nineDigits}${firstDigit}`)}`;
}

function formatCpf(cpf: string): string {
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

function normalizedPhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 13 && digits.startsWith('55') ? digits.slice(2) : digits;
}

function dateInSaoPaulo(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function minimalPdf(): Buffer {
  const header = '%PDF-1.4\n';
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 72 72] /Contents 4 0 R >>\nendobj\n',
    '4 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj\n',
  ];
  const offsets: number[] = [];
  let document = header;
  for (const object of objects) {
    offsets.push(Buffer.byteLength(document));
    document += object;
  }
  const xrefOffset = Buffer.byteLength(document);
  const entries = offsets
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  document += `xref\n0 5\n0000000000 65535 f \n${entries}`;
  document += `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(document, 'ascii');
}

function minimalPng(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
}

function isolatedPastCivilDate(seed: number): string {
  const dayIndex = Math.abs(seed) % (200 * 12 * 28);
  const year = 1800 + Math.floor(dayIndex / (12 * 28));
  const month = Math.floor((dayIndex % (12 * 28)) / 28) + 1;
  const day = (dayIndex % 28) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

describe('Tenancy Ledger API (e2e)', () => {
  jest.setTimeout(120_000);

  let app: INestApplication | undefined;
  let dataSource: DataSource;
  let users: Repository<User>;
  let auditLogs: Repository<AuditLog>;
  let invoices: Repository<Invoice>;

  let adminToken = '';
  let adminId = '';
  let adminRefreshCookie = '';
  let managerToken = '';
  let managerId = '';
  let viewerToken = '';
  let viewerId = '';
  let tenantId = '';
  let propertyId = '';
  let contractId = '';
  let invoiceId = '';
  let cashPaymentId = '';
  let pixPaymentId = '';
  let onboardingDraftId = '';
  let onboardingTenantId = '';
  let onboardingPropertyId = '';
  let onboardingContractId = '';
  let onboardingInvoiceId = '';
  let onboardingPaymentId = '';
  let onboardingReceiptId = '';
  let onboardingDocumentId = '';
  let onboardingReferenceId = '';

  const suffix = uniqueSuffix();
  const numericSeed = `${Date.now()}${process.pid}`.replace(/\D/g, '').slice(-9);
  const tenantCpf = validCpf(numericSeed);
  const onboardingCpf = validCpf((BigInt(numericSeed) + 137n).toString());
  const isolatedCashboxDate = isolatedPastCivilDate(Date.now() + process.pid);
  const tenantInput: TenantInput = {
    name: `Locatária E2E ${suffix}`,
    cpf: formatCpf(tenantCpf),
    rg: `RG${Date.now().toString(36).slice(-10).toUpperCase()}`,
    profession: 'Engenheira de Software',
    civilStatus: 'SINGLE',
    email: `e2e.tenant.${suffix}@example.test`,
    mobilePhone: `+55 11 9${String(Date.now()).slice(-8)}`,
  };
  const successfulTenantRequestId = `e2e-tenant-${suffix}`;
  const deniedViewerRequestId = `e2e-denied-${suffix}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const nestApp = moduleFixture.createNestApplication();
    app = nestApp;
    configureApp(nestApp);
    await nestApp.init();

    dataSource = nestApp.get(DataSource);
    users = dataSource.getRepository(User);
    auditLogs = dataSource.getRepository(AuditLog);
    invoices = dataSource.getRepository(Invoice);
  });

  afterAll(async () => {
    await app?.close();
  });

  function httpServer(): App {
    if (!app) throw new Error('E2E application was not initialized');
    return app.getHttpServer() as App;
  }

  it('keeps root and health endpoints public', async () => {
    const root = await request(httpServer()).get('/').expect(200);
    expect(responseBody(root)).toEqual({
      name: 'Tenancy Ledger API',
      status: 'ok',
      documentation: '/docs',
    });

    const live = await request(httpServer()).get('/health').expect(200);
    expect(asRecord(responseBody(live)).status).toBe('ok');

    const readiness = await request(httpServer()).get('/health/ready').expect(200);
    const readinessBody = asRecord(responseBody(readiness));
    expect(readinessBody.status).toBe('ok');
    expect(asRecord(readinessBody.info, 'readiness info')).toMatchObject({
      database: { status: 'up' },
      objectStorage: { status: 'up' },
    });
  });

  it('rejects protected requests without a bearer token', async () => {
    const requestId = `e2e-unauthorized-${suffix}`;
    const response = await request(httpServer())
      .get('/tenants?page=1&limit=1')
      .set('x-request-id', requestId)
      .expect('content-type', /application\/problem\+json/)
      .expect(401);

    expect(asRecord(responseBody(response))).toMatchObject({
      status: 401,
      instance: '/tenants?page=1&limit=1',
      requestId,
    });
  });

  it('logs in the configured bootstrap administrator', async () => {
    const email = process.env.AUTH_BOOTSTRAP_EMAIL ?? 'admin@example.com';
    const password = process.env.AUTH_BOOTSTRAP_PASSWORD ?? 'ChangeMeNow123!';
    const response = await request(httpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    const body = asRecord(responseBody(response));
    const user = asRecord(body.user, 'authenticated user');

    adminToken = readString(body, 'accessToken');
    adminId = readString(user, 'id');
    const refreshCookie = firstResponseCookie(response);
    adminRefreshCookie = refreshCookie.split(';')[0] ?? '';
    expect(adminToken.split('.')).toHaveLength(3);
    expect(user).toMatchObject({ email: email.toLowerCase(), role: 'ADMIN' });
    expect(JSON.stringify(body)).not.toContain('password');
    expect(JSON.stringify(body)).not.toContain('refreshToken');
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('SameSite=Strict');
  });

  it('rotaciona o refresh token opaco sem expô-lo no corpo', async () => {
    const previousCookie = adminRefreshCookie;
    const response = await request(httpServer())
      .post('/auth/refresh')
      .set('cookie', previousCookie)
      .expect(200);
    const body = asRecord(responseBody(response));
    const refreshCookie = firstResponseCookie(response);
    adminRefreshCookie = refreshCookie.split(';')[0] ?? '';
    adminToken = readString(body, 'accessToken');

    expect(adminRefreshCookie).not.toBe(previousCookie);
    expect(body).not.toHaveProperty('refreshToken');
    expect(asRecord(body.user, 'refreshed user')).toMatchObject({ id: adminId, role: 'ADMIN' });
  });

  it('creates a tenant and returns unminimized contact data to ADMIN', async () => {
    const response = await request(httpServer())
      .post('/tenants')
      .set('authorization', `Bearer ${adminToken}`)
      .set('x-request-id', successfulTenantRequestId)
      .send(tenantInput)
      .expect(201);
    const body = asRecord(responseBody(response));

    tenantId = readString(body, 'id');
    expect(body).toMatchObject({
      name: tenantInput.name,
      cpf: tenantCpf,
      profession: tenantInput.profession,
      civilStatus: tenantInput.civilStatus,
      email: tenantInput.email,
      mobilePhone: normalizedPhoneDigits(tenantInput.mobilePhone),
    });
    expect(body).not.toHaveProperty('rg');
    expect(JSON.stringify(body)).not.toContain(tenantInput.rg);
  });

  it('returns 409 when normalized tenant identity data is duplicated', async () => {
    const response = await request(httpServer())
      .post('/tenants')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        ...tenantInput,
        cpf: tenantCpf,
        rg: `DUP${Date.now().toString(36).toUpperCase()}`,
        email: `different.${suffix}@example.test`,
        mobilePhone: '+55 21 99999-9999',
      })
      .expect('content-type', /application\/problem\+json/)
      .expect(409);

    expect(asRecord(responseBody(response))).toMatchObject({ status: 409 });
  });

  it('paginates tenants without ever exposing the RG', async () => {
    const response = await request(httpServer())
      .get('/tenants?page=1&limit=1')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const body = asRecord(responseBody(response));
    const data = asArray(body.data, 'tenant page data');
    const meta = asRecord(body.meta, 'tenant page metadata');

    expect(data).toHaveLength(1);
    expect(meta).toMatchObject({ page: 1, limit: 1 });
    expect(meta.total).toEqual(expect.any(Number));
    expect(meta.totalPages).toEqual(expect.any(Number));
    expect(JSON.stringify(data)).not.toContain('"rg"');
  });

  it('creates a building, a property unit linked to it, and an active contract', async () => {
    const buildingResponse = await request(httpServer())
      .post('/buildings')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        name: `Edifício E2E ${suffix}`,
        neighborhood: `E2E-${suffix}`,
      })
      .expect(201);
    const buildingId = readString(asRecord(responseBody(buildingResponse)), 'id');

    const propertyResponse = await request(httpServer())
      .post('/properties')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        neighborhood: `E2E-${suffix}`,
        type: 'APARTMENT',
        unitNumber: `UNIT-${suffix}`,
        buildingId,
      })
      .expect(201);
    const createdProperty = asRecord(responseBody(propertyResponse));
    propertyId = readString(createdProperty, 'id');
    expect(createdProperty).toMatchObject({
      buildingId,
      buildingName: `Edifício E2E ${suffix}`,
      occupied: false,
    });

    const emptyBuildingResponse = await request(httpServer())
      .get(`/buildings/${buildingId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(asRecord(responseBody(emptyBuildingResponse))).toMatchObject({
      totalUnits: 1,
      occupiedUnits: 0,
    });

    const today = dateInSaoPaulo();
    const contractResponse = await request(httpServer())
      .post('/contracts')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        tenantId,
        propertyUnitId: propertyId,
        moveInDate: `${today.slice(0, 7)}-01`,
        monthlyBaseValueCents: 150_000,
        durationInMonths: 12,
        billingDay: Math.min(Number(today.slice(-2)), 28),
        isRenewable: true,
      })
      .expect(201);
    const contract = asRecord(responseBody(contractResponse));
    contractId = readString(contract, 'id');

    expect(contract).toMatchObject({
      tenantId,
      propertyUnitId: propertyId,
      monthlyBaseValueCents: 150_000,
      status: 'ACTIVE',
    });

    const occupiedPropertyResponse = await request(httpServer())
      .get(`/properties/${propertyId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(asRecord(responseBody(occupiedPropertyResponse))).toMatchObject({
      buildingId,
      occupied: true,
    });

    const occupiedBuildingResponse = await request(httpServer())
      .get(`/buildings/${buildingId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(asRecord(responseBody(occupiedBuildingResponse))).toMatchObject({
      totalUnits: 1,
      occupiedUnits: 1,
    });

    const buildingsListResponse = await request(httpServer())
      .get(`/buildings?q=${encodeURIComponent(suffix)}&page=1&limit=10`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const buildingsList = asArray(
      asRecord(responseBody(buildingsListResponse)).data,
      'buildings list data',
    ).map((entry) => asRecord(entry, 'building'));
    expect(buildingsList).toContainEqual(
      expect.objectContaining({ id: buildingId, totalUnits: 1, occupiedUnits: 1 }),
    );
  });

  it('serializes concurrent renewals without losing either extension', async () => {
    const renew = (): request.Test =>
      request(httpServer())
        .patch(`/contracts/${contractId}/renew`)
        .set('authorization', `Bearer ${adminToken}`)
        .send({ extraMonths: 1 });

    const responses = await Promise.all([renew().expect(200), renew().expect(200)]);
    const returnedDurations = responses
      .map((response) => Number(asRecord(responseBody(response)).durationInMonths))
      .sort((left, right) => left - right);
    expect(returnedDurations).toEqual([13, 14]);

    const finalResponse = await request(httpServer())
      .get(`/contracts/${contractId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(asRecord(responseBody(finalResponse))).toMatchObject({ durationInMonths: 14 });
  });

  it('denies writes to VIEWER users and records the authorization denial', async () => {
    const viewerEmail = `e2e.viewer.${suffix}@example.test`;
    const viewerPassword = `Viewer-${suffix}-Password!`;
    const savedViewer = await users.save(
      User.create(viewerEmail, await hash(viewerPassword, 12), UserRole.VIEWER),
    );
    viewerId = savedViewer.id;

    const loginResponse = await request(httpServer())
      .post('/auth/login')
      .send({ email: viewerEmail, password: viewerPassword })
      .expect(200);
    viewerToken = readString(asRecord(responseBody(loginResponse)), 'accessToken');

    const deniedResponse = await request(httpServer())
      .post('/properties')
      .set('authorization', `Bearer ${viewerToken}`)
      .set('x-request-id', deniedViewerRequestId)
      .send({ neighborhood: 'Forbidden', type: 'ROOM', unitNumber: suffix })
      .expect('content-type', /application\/problem\+json/)
      .expect(403);
    expect(asRecord(responseBody(deniedResponse))).toMatchObject({
      status: 403,
      requestId: deniedViewerRequestId,
    });

    const deniedAudit = await auditLogs.findOneOrFail({
      where: { requestId: deniedViewerRequestId },
    });
    expect(deniedAudit).toMatchObject({
      actorId: viewerId,
      action: `DENIED POST /properties`,
      resourceType: 'properties',
    });
    expect(deniedAudit.metadata).toMatchObject({ statusCode: 403, role: 'VIEWER' });
  });

  it('mascara o contato do locatário para VIEWER', async () => {
    const response = await request(httpServer())
      .get(`/tenants/${tenantId}`)
      .set('authorization', `Bearer ${viewerToken}`)
      .expect(200);
    const body = asRecord(responseBody(response));

    expect(body).toMatchObject({
      name: tenantInput.name,
      cpf: `***.***.***-${tenantCpf.slice(-2)}`,
      email: 'e***@example.test',
      mobilePhone: `(**) *****-${normalizedPhoneDigits(tenantInput.mobilePhone).slice(-4)}`,
    });
    expect(JSON.stringify(body)).not.toContain(tenantCpf);
  });

  it('creates a separate manager to enforce four-eyes payment review', async () => {
    const managerEmail = `e2e.manager.${suffix}@example.test`;
    const managerPassword = `Manager-${suffix}-Password!`;
    const savedManager = await users.save(
      User.create(managerEmail, await hash(managerPassword, 12), UserRole.MANAGER),
    );
    managerId = savedManager.id;

    const loginResponse = await request(httpServer())
      .post('/auth/login')
      .send({ email: managerEmail, password: managerPassword })
      .expect(200);
    managerToken = readString(asRecord(responseBody(loginResponse)), 'accessToken');
    expect(managerToken.split('.')).toHaveLength(3);
  });

  it('generates exactly one invoice per contract and competence when rerun', async () => {
    expect(process.env.INVOICE_CRON_ENABLED).toBe('false');
    if (!app) throw new Error('E2E application was not initialized');
    const worker = app.get(InvoiceGenerationWorker);
    const competence = dateInSaoPaulo().slice(0, 7);

    await worker.generateUpcomingInvoices();
    await worker.generateUpcomingInvoices();

    const matchingInvoices = await invoices
      .createQueryBuilder('invoice')
      .where('invoice.contract_id = :contractId', { contractId })
      .andWhere('invoice.competence = :competence', { competence })
      .getMany();
    expect(matchingInvoices).toHaveLength(1);
    const generated = matchingInvoices[0];
    if (!generated) throw new Error('Invoice was not generated');
    invoiceId = generated.id;

    const response = await request(httpServer())
      .get(`/invoices?contractId=${contractId}&competence=${competence}&page=1&limit=10`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const page = asRecord(responseBody(response));
    expect(asArray(page.data, 'invoice page data')).toHaveLength(1);
    expect(asRecord(page.meta, 'invoice page metadata')).toMatchObject({ total: 1 });
  });

  it('submits and approves a partial CASH payment', async () => {
    const idempotencyKey = `cash-payment-${suffix}`;
    const submit = (): request.Test =>
      request(httpServer())
        .post(`/invoices/${invoiceId}/payments`)
        .set('authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .field('amountCents', '50000')
        .field('method', 'CASH');

    const [submitResponse, concurrentRetry] = await Promise.all([
      submit().expect(201),
      submit().expect(201),
    ]);
    const submittedInvoice = asRecord(responseBody(submitResponse));
    const submittedPayments = asArray(submittedInvoice.payments, 'submitted invoice payments');
    const cashPayment = asRecord(submittedPayments[0], 'cash payment');
    cashPaymentId = readString(cashPayment, 'id');

    const retriedInvoice = asRecord(responseBody(concurrentRetry));
    const retriedPayments = asArray(retriedInvoice.payments, 'retried invoice payments');
    expect(retriedPayments).toHaveLength(1);
    expect(readString(asRecord(retriedPayments[0], 'retried payment'), 'id')).toBe(cashPaymentId);

    expect(submittedInvoice.status).toBe('UNDER_REVIEW');
    expect(cashPayment).toMatchObject({
      amountCents: 50_000,
      method: 'CASH',
      hasProof: false,
      status: 'SUBMITTED',
    });

    await request(httpServer())
      .post(`/invoices/${invoiceId}/payments`)
      .set('authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .field('amountCents', '40000')
      .field('method', 'CASH')
      .expect(409);

    await request(httpServer())
      .patch(`/invoices/${invoiceId}/payments/${cashPaymentId}/approve`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(409);

    const approveResponse = await request(httpServer())
      .patch(`/invoices/${invoiceId}/payments/${cashPaymentId}/approve`)
      .set('authorization', `Bearer ${managerToken}`)
      .expect(200);
    const approvedInvoice = asRecord(responseBody(approveResponse));
    expect(approvedInvoice).toMatchObject({
      status: 'PARTIALLY_PAID',
      approvedAmountCents: 50_000,
      outstandingAmountCents: 100_000,
    });
  });

  it('rejects an invalid repeated payment-state transition', async () => {
    const response = await request(httpServer())
      .patch(`/invoices/${invoiceId}/payments/${cashPaymentId}/approve`)
      .set('authorization', `Bearer ${managerToken}`)
      .expect('content-type', /application\/problem\+json/)
      .expect(409);
    expect(asRecord(responseBody(response))).toMatchObject({ status: 409 });
  });

  it('uploads a PIX proof without leaking its object key and returns a signed URL', async () => {
    const submitResponse = await request(httpServer())
      .post(`/invoices/${invoiceId}/payments`)
      .set('authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', `pix-payment-${suffix}`)
      .field('amountCents', '25000')
      .field('method', 'PIX')
      .field('proofType', 'BANK_STATEMENT')
      .attach('proof', minimalPdf(), {
        filename: 'pix-proof.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const invoice = asRecord(responseBody(submitResponse));
    const payments = asArray(invoice.payments, 'invoice payments');
    const pixPayment = payments
      .map((payment) => asRecord(payment, 'payment'))
      .find((payment) => payment.method === 'PIX');
    if (!pixPayment) throw new Error('PIX payment was not returned');
    pixPaymentId = readString(pixPayment, 'id');

    expect(pixPayment).toMatchObject({
      amountCents: 25_000,
      method: 'PIX',
      proofType: 'BANK_STATEMENT',
      hasProof: true,
      status: 'SUBMITTED',
    });
    expect(pixPayment).not.toHaveProperty('proofReference');
    expect(pixPayment).not.toHaveProperty('key');
    expect(JSON.stringify(invoice)).not.toContain('payment-proofs/');

    const proofResponse = await request(httpServer())
      .get(`/invoices/${invoiceId}/payments/${pixPaymentId}/proof`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const proof = asRecord(responseBody(proofResponse));
    const signedUrl = new URL(readString(proof, 'url'));
    expect(proof.expiresInSeconds).toBe(300);
    expect(signedUrl.origin).toBe('http://localhost:9000');
    expect(signedUrl.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/i);
    expect(signedUrl.searchParams.get('X-Amz-Expires')).toBe('300');
  });

  it('rejects a submitted PIX payment and prevents reviewing it twice', async () => {
    await request(httpServer())
      .patch(`/invoices/${invoiceId}/payments/${pixPaymentId}/reject`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ reason: 'O autor não pode revisar a própria submissão.' })
      .expect(409);

    const rejectResponse = await request(httpServer())
      .patch(`/invoices/${invoiceId}/payments/${pixPaymentId}/reject`)
      .set('authorization', `Bearer ${managerToken}`)
      .send({ reason: 'Comprovante divergente no teste E2E.' })
      .expect(200);
    const invoice = asRecord(responseBody(rejectResponse));
    const pixPayment = asArray(invoice.payments, 'invoice payments')
      .map((payment) => asRecord(payment, 'payment'))
      .find((payment) => payment.id === pixPaymentId);

    expect(invoice).toMatchObject({
      status: 'PARTIALLY_PAID',
      approvedAmountCents: 50_000,
      outstandingAmountCents: 100_000,
    });
    expect(pixPayment).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Comprovante divergente no teste E2E.',
    });

    await request(httpServer())
      .patch(`/invoices/${invoiceId}/payments/${pixPaymentId}/reject`)
      .set('authorization', `Bearer ${managerToken}`)
      .send({ reason: 'Segunda revisão inválida.' })
      .expect(409);
  });

  it('persiste e isola notificações de submissão e revisão por usuário', async () => {
    const managerPageResponse = await request(httpServer())
      .get('/notifications?page=1&limit=20')
      .set('authorization', `Bearer ${managerToken}`)
      .expect(200);
    const managerPage = asRecord(responseBody(managerPageResponse));
    const managerNotifications = asArray(managerPage.data, 'manager notifications').map((entry) =>
      asRecord(entry, 'notification'),
    );
    const submitted = managerNotifications.find(
      (entry) => entry.type === 'PAYMENT_SUBMITTED' && entry.resourceId === invoiceId,
    );
    if (!submitted) throw new Error('Manager did not receive the payment notification');
    expect(submitted).toMatchObject({ resourceType: 'INVOICE', readAt: null });
    expect(Number(managerPage.unreadCount)).toBeGreaterThanOrEqual(2);

    await request(httpServer())
      .patch(`/notifications/${readString(submitted, 'id')}/read`)
      .set('authorization', `Bearer ${managerToken}`)
      .expect(200);
    await request(httpServer())
      .patch('/notifications/read-all')
      .set('authorization', `Bearer ${managerToken}`)
      .expect(204);

    const readPageResponse = await request(httpServer())
      .get('/notifications?page=1&limit=20')
      .set('authorization', `Bearer ${managerToken}`)
      .expect(200);
    expect(asRecord(responseBody(readPageResponse)).unreadCount).toBe(0);

    const adminPageResponse = await request(httpServer())
      .get('/notifications?page=1&limit=20')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const adminTypes = asArray(
      asRecord(responseBody(adminPageResponse)).data,
      'admin notifications',
    ).map((entry) => asRecord(entry, 'notification').type);
    expect(adminTypes).toEqual(expect.arrayContaining(['PAYMENT_APPROVED', 'PAYMENT_REJECTED']));
    expect(managerId).not.toBe(adminId);
  });

  it('records successful authenticated mutations with actor and resource correlation', async () => {
    const successfulAudit = await auditLogs.findOneOrFail({
      where: { requestId: successfulTenantRequestId },
    });

    expect(successfulAudit).toMatchObject({
      actorId: adminId,
      action: 'POST /tenants',
      resourceType: 'tenants',
      resourceId: tenantId,
      requestId: successfulTenantRequestId,
    });
    expect(successfulAudit.metadata).toMatchObject({
      method: 'POST',
      path: '/tenants',
      statusCode: 201,
      role: 'ADMIN',
    });
  });

  it('persists, isolates, updates, discards, and completes onboarding drafts', async () => {
    const propertyResponse = await request(httpServer())
      .post('/properties')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        neighborhood: `Onboarding ${suffix}`,
        type: 'HOUSE',
        unitNumber: `ONBOARDING-${suffix}`,
      })
      .expect(201);
    onboardingPropertyId = readString(asRecord(responseBody(propertyResponse)), 'id');

    const availableResponse = await request(httpServer())
      .get('/properties/available')
      .query({
        date: dateInSaoPaulo(),
        neighborhood: `Onboarding ${suffix}`,
        type: 'HOUSE',
      })
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      asArray(responseBody(availableResponse), 'available properties').map((entry) =>
        readString(asRecord(entry, 'available property'), 'id'),
      ),
    ).toContain(onboardingPropertyId);

    const initialDraftResponse = await request(httpServer())
      .post('/onboarding-drafts')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ payload: { version: 0, currentStep: 1 } })
      .expect(201);
    const initialDraft = asRecord(responseBody(initialDraftResponse));
    onboardingDraftId = readString(initialDraft, 'id');
    expect(initialDraft).toMatchObject({
      status: 'DRAFT',
      createdByUserId: adminId,
      payload: { version: 0, currentStep: 1 },
    });

    await request(httpServer())
      .get(`/onboarding-drafts/${onboardingDraftId}`)
      .set('authorization', `Bearer ${managerToken}`)
      .expect(404);

    const onboardingPhone = `+55 11 98${String(Date.now()).slice(-7)}`;
    const payload = {
      version: 1,
      currentStep: 5,
      personalData: {
        name: `Locatária Onboarding ${suffix}`,
        cpf: formatCpf(onboardingCpf),
        rg: `ONB${Date.now().toString(36).toUpperCase()}`,
        profession: 'Arquiteta',
        civilStatus: 'SINGLE',
        email: `onboarding.${suffix}@example.test`,
        mobilePhone: onboardingPhone,
      },
      references: [
        {
          name: 'Referência familiar',
          relationship: 'Irmã',
          phone: `+55 21 97${String(Date.now() + 1).slice(-7)}`,
          email: `reference.one.${suffix}@example.test`,
        },
        {
          name: 'Referência profissional',
          relationship: 'Colega',
          phone: `+55 31 96${String(Date.now() + 2).slice(-7)}`,
        },
      ],
      propertyUnitId: onboardingPropertyId,
      moveInDate: dateInSaoPaulo(),
      monthlyBaseValueCents: 175_000,
    };

    const updatedDraftResponse = await request(httpServer())
      .patch(`/onboarding-drafts/${onboardingDraftId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ payload })
      .expect(200);
    expect(asRecord(responseBody(updatedDraftResponse))).toMatchObject({
      id: onboardingDraftId,
      status: 'DRAFT',
      payload,
    });

    const getDraftResponse = await request(httpServer())
      .get(`/onboarding-drafts/${onboardingDraftId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(asRecord(responseBody(getDraftResponse))).toMatchObject({ id: onboardingDraftId });

    const listDraftsResponse = await request(httpServer())
      .get('/onboarding-drafts?status=DRAFT&page=1&limit=100')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const draftPage = asRecord(responseBody(listDraftsResponse));
    expect(
      asArray(draftPage.data, 'onboarding draft page').map((entry) =>
        readString(asRecord(entry, 'onboarding draft'), 'id'),
      ),
    ).toContain(onboardingDraftId);

    const managerDraftResponse = await request(httpServer())
      .post('/onboarding-drafts')
      .set('authorization', `Bearer ${managerToken}`)
      .send({ payload: { version: 1, currentStep: 1, owner: 'manager' } })
      .expect(201);
    const managerDraftId = readString(asRecord(responseBody(managerDraftResponse)), 'id');
    await request(httpServer())
      .get(`/onboarding-drafts/${managerDraftId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    await request(httpServer())
      .delete(`/onboarding-drafts/${managerDraftId}`)
      .set('authorization', `Bearer ${managerToken}`)
      .expect(204);
    const discardedDraftResponse = await request(httpServer())
      .get(`/onboarding-drafts/${managerDraftId}`)
      .set('authorization', `Bearer ${managerToken}`)
      .expect(200);
    expect(asRecord(responseBody(discardedDraftResponse)).status).toBe('DISCARDED');

    const invalidDraftResponse = await request(httpServer())
      .post('/onboarding-drafts')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ payload: { version: 1, references: [] } })
      .expect(201);
    const invalidDraftId = readString(asRecord(responseBody(invalidDraftResponse)), 'id');
    await request(httpServer())
      .post(`/onboarding-drafts/${invalidDraftId}/complete`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(422);
    await request(httpServer())
      .delete(`/onboarding-drafts/${invalidDraftId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(204);

    const completionResponse = await request(httpServer())
      .post(`/onboarding-drafts/${onboardingDraftId}/complete`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const completion = asRecord(responseBody(completionResponse));
    onboardingTenantId = readString(completion, 'tenantId');
    onboardingContractId = readString(completion, 'contractId');
    onboardingInvoiceId = readString(completion, 'invoiceId');
    expect(completion).toMatchObject({ draftId: onboardingDraftId, status: 'COMPLETED' });

    const invoiceResponse = await request(httpServer())
      .get(`/invoices/${onboardingInvoiceId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(asRecord(responseBody(invoiceResponse))).toMatchObject({
      id: onboardingInvoiceId,
      contractId: onboardingContractId,
      totalValueCents: 175_000,
      status: 'OPEN',
    });

    const contractResponse = await request(httpServer())
      .get(`/contracts/${onboardingContractId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(asRecord(responseBody(contractResponse))).toMatchObject({
      id: onboardingContractId,
      tenantId: onboardingTenantId,
      propertyUnitId: onboardingPropertyId,
      contractType: 'MONTH_TO_MONTH',
      durationInMonths: null,
      endDate: null,
      status: 'PENDING_SIGNATURE',
    });

    await request(httpServer())
      .post(`/onboarding-drafts/${onboardingDraftId}/complete`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(409);
    await request(httpServer())
      .patch(`/onboarding-drafts/${onboardingDraftId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ payload })
      .expect(409);
    await request(httpServer())
      .delete(`/onboarding-drafts/${onboardingDraftId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(409);
  });

  it('persists a draft photo across resumption, replaces it, and promotes it on completion', async () => {
    const propertyResponse = await request(httpServer())
      .post('/properties')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        neighborhood: `Foto ${suffix}`,
        type: 'HOUSE',
        unitNumber: `FOTO-${suffix}`,
      })
      .expect(201);
    const photoPropertyId = readString(asRecord(responseBody(propertyResponse)), 'id');

    const draftResponse = await request(httpServer())
      .post('/onboarding-drafts')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ payload: { version: 0, currentStep: 1 } })
      .expect(201);
    const photoDraftId = readString(asRecord(responseBody(draftResponse)), 'id');

    await request(httpServer())
      .post(`/onboarding-drafts/${photoDraftId}/photo`)
      .set('authorization', `Bearer ${adminToken}`)
      .attach('photo', minimalPng(), { filename: 'draft-photo.png', contentType: 'image/png' })
      .expect(204);

    const draftAfterUpload = await request(httpServer())
      .get(`/onboarding-drafts/${photoDraftId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(asRecord(responseBody(draftAfterUpload))).toMatchObject({ hasPhoto: true });

    const firstDownload = await request(httpServer())
      .get(`/onboarding-drafts/${photoDraftId}/photo/download`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const firstDownloadBody = asRecord(responseBody(firstDownload));
    expect(firstDownloadBody.expiresInSeconds).toBe(300);
    expect(new URL(readString(firstDownloadBody, 'url')).searchParams.get('X-Amz-Expires')).toBe(
      '300',
    );

    await request(httpServer())
      .post(`/onboarding-drafts/${photoDraftId}/photo`)
      .set('authorization', `Bearer ${adminToken}`)
      .attach('photo', minimalPng(), { filename: 'replacement.png', contentType: 'image/png' })
      .expect(204);

    const draftAfterReplace = await request(httpServer())
      .get(`/onboarding-drafts/${photoDraftId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(asRecord(responseBody(draftAfterReplace))).toMatchObject({ hasPhoto: true });

    const photoCpf = validCpf((BigInt(numericSeed) + 409n).toString());
    const photoPayload = {
      version: 1,
      currentStep: 5,
      personalData: {
        name: `Locatária Foto ${suffix}`,
        cpf: formatCpf(photoCpf),
        rg: `FOT${Date.now().toString(36).toUpperCase()}`,
        profession: 'Designer',
        civilStatus: 'SINGLE',
        email: `foto.${suffix}@example.test`,
        mobilePhone: `+55 11 96${String(Date.now()).slice(-7)}`,
      },
      references: [
        {
          name: 'Referência pessoal',
          relationship: 'Prima',
          phone: `+55 21 93${String(Date.now() + 5).slice(-7)}`,
        },
        {
          name: 'Referência profissional',
          relationship: 'Gestora',
          phone: `+55 31 92${String(Date.now() + 6).slice(-7)}`,
        },
      ],
      propertyUnitId: photoPropertyId,
      moveInDate: dateInSaoPaulo(),
      monthlyBaseValueCents: 130_000,
    };
    await request(httpServer())
      .patch(`/onboarding-drafts/${photoDraftId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ payload: photoPayload })
      .expect(200);

    const completionResponse = await request(httpServer())
      .post(`/onboarding-drafts/${photoDraftId}/complete`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const photoTenantId = readString(asRecord(responseBody(completionResponse)), 'tenantId');

    const tenantPhotoResponse = await request(httpServer())
      .get(`/tenants/${photoTenantId}/photo/download`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const tenantPhotoBody = asRecord(responseBody(tenantPhotoResponse));
    expect(tenantPhotoBody.expiresInSeconds).toBe(300);
  });

  it('removes the draft photo on explicit removal and on discard', async () => {
    const removalDraftResponse = await request(httpServer())
      .post('/onboarding-drafts')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ payload: { version: 0, currentStep: 1 } })
      .expect(201);
    const removalDraftId = readString(asRecord(responseBody(removalDraftResponse)), 'id');

    await request(httpServer())
      .post(`/onboarding-drafts/${removalDraftId}/photo`)
      .set('authorization', `Bearer ${adminToken}`)
      .attach('photo', minimalPng(), { filename: 'removal.png', contentType: 'image/png' })
      .expect(204);
    await request(httpServer())
      .delete(`/onboarding-drafts/${removalDraftId}/photo`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(204);
    const afterRemoval = await request(httpServer())
      .get(`/onboarding-drafts/${removalDraftId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(asRecord(responseBody(afterRemoval))).toMatchObject({ hasPhoto: false });
    await request(httpServer())
      .get(`/onboarding-drafts/${removalDraftId}/photo/download`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(404);

    const discardDraftResponse = await request(httpServer())
      .post('/onboarding-drafts')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ payload: { version: 0, currentStep: 1 } })
      .expect(201);
    const discardDraftId = readString(asRecord(responseBody(discardDraftResponse)), 'id');
    await request(httpServer())
      .post(`/onboarding-drafts/${discardDraftId}/photo`)
      .set('authorization', `Bearer ${adminToken}`)
      .attach('photo', minimalPng(), { filename: 'discard.png', contentType: 'image/png' })
      .expect(204);

    await request(httpServer())
      .delete(`/onboarding-drafts/${discardDraftId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(httpServer())
      .get(`/onboarding-drafts/${discardDraftId}/photo/download`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('manages onboarding tenant references and photo through protected HTTP endpoints', async () => {
    const referencesResponse = await request(httpServer())
      .get(`/tenants/${onboardingTenantId}/references`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const references = asArray(responseBody(referencesResponse), 'tenant references').map((entry) =>
      asRecord(entry, 'tenant reference'),
    );
    expect(references).toHaveLength(2);
    onboardingReferenceId = readString(references[0] ?? {}, 'id');

    const referenceResponse = await request(httpServer())
      .get(`/tenants/${onboardingTenantId}/references/${onboardingReferenceId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(asRecord(responseBody(referenceResponse))).toMatchObject({
      id: onboardingReferenceId,
      tenantId: onboardingTenantId,
    });

    const updateReferenceResponse = await request(httpServer())
      .patch(`/tenants/${onboardingTenantId}/references/${onboardingReferenceId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Contato confirmado durante o onboarding.' })
      .expect(200);
    expect(asRecord(responseBody(updateReferenceResponse)).notes).toBe(
      'Contato confirmado durante o onboarding.',
    );

    const verifyReferenceResponse = await request(httpServer())
      .patch(`/tenants/${onboardingTenantId}/references/${onboardingReferenceId}/verify`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(asRecord(responseBody(verifyReferenceResponse))).toMatchObject({
      verifiedByUserId: adminId,
    });

    const createdReferenceResponse = await request(httpServer())
      .post(`/tenants/${onboardingTenantId}/references`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Contato adicional',
        relationship: 'Amigo',
        phone: `+55 41 95${String(Date.now() + 3).slice(-7)}`,
        email: `additional.reference.${suffix}@example.test`,
        notes: 'Criado no teste E2E.',
      })
      .expect(201);
    const createdReferenceId = readString(asRecord(responseBody(createdReferenceResponse)), 'id');
    await request(httpServer())
      .delete(`/tenants/${onboardingTenantId}/references/${createdReferenceId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(204);
    await request(httpServer())
      .get(`/tenants/${onboardingTenantId}/references/${createdReferenceId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(404);

    await request(httpServer())
      .post(`/tenants/${onboardingTenantId}/photo`)
      .set('authorization', `Bearer ${adminToken}`)
      .attach('photo', minimalPng(), { filename: 'tenant.png', contentType: 'image/png' })
      .expect(204);
    const photoResponse = await request(httpServer())
      .get(`/tenants/${onboardingTenantId}/photo/download`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const photo = asRecord(responseBody(photoResponse));
    expect(photo.expiresInSeconds).toBe(300);
    expect(new URL(readString(photo, 'url')).searchParams.get('X-Amz-Expires')).toBe('300');

    await request(httpServer())
      .post(`/tenants/${onboardingTenantId}/photo`)
      .set('authorization', `Bearer ${adminToken}`)
      .attach('photo', minimalPng(), { filename: 'replacement.png', contentType: 'image/png' })
      .expect(204);
  });

  it('previews and versions signed contract documents before activating the contract', async () => {
    const previewResponse = await request(httpServer())
      .get(`/contracts/${onboardingContractId}/document/preview`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect('content-type', /application\/pdf/)
      .expect(200);
    expect(Buffer.isBuffer(previewResponse.body)).toBe(true);
    expect((previewResponse.body as Buffer).subarray(0, 5).toString('ascii')).toBe('%PDF-');

    await request(httpServer())
      .post(`/contracts/${onboardingContractId}/documents/generate`)
      .set('authorization', `Bearer ${viewerToken}`)
      .expect(403);

    const firstGeneratedResponse = await request(httpServer())
      .post(`/contracts/${onboardingContractId}/documents/generate`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(201);
    const firstGenerated = asRecord(responseBody(firstGeneratedResponse));
    expect(firstGenerated).toMatchObject({
      contractId: onboardingContractId,
      kind: 'GENERATED',
      version: 1,
      contentType: 'application/pdf',
      expiresInSeconds: 300,
    });
    expect(
      new URL(readString(firstGenerated, 'url')).searchParams.get('response-content-disposition'),
    ).toBe('inline');

    const secondGeneratedResponse = await request(httpServer())
      .post(`/contracts/${onboardingContractId}/documents/generate`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(asRecord(responseBody(secondGeneratedResponse))).toMatchObject({
      kind: 'GENERATED',
      version: 2,
    });

    const signedResponse = await request(httpServer())
      .post(`/contracts/${onboardingContractId}/documents`)
      .set('authorization', `Bearer ${adminToken}`)
      .field('kind', 'SIGNED')
      .attach('document', minimalPdf(), {
        filename: 'signed-contract.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const signedDocument = asRecord(responseBody(signedResponse));
    onboardingDocumentId = readString(signedDocument, 'id');
    expect(signedDocument).toMatchObject({
      contractId: onboardingContractId,
      kind: 'SIGNED',
      version: 1,
      expiresInSeconds: 300,
    });

    await request(httpServer())
      .post(`/contracts/${onboardingContractId}/documents`)
      .set('authorization', `Bearer ${adminToken}`)
      .field('kind', 'OTHER')
      .attach('document', minimalPdf(), {
        filename: 'inspection.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const secondSignedResponse = await request(httpServer())
      .post(`/contracts/${onboardingContractId}/documents`)
      .set('authorization', `Bearer ${adminToken}`)
      .field('kind', 'SIGNED')
      .attach('document', minimalPdf(), {
        filename: 'signed-contract-v2.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    expect(asRecord(responseBody(secondSignedResponse))).toMatchObject({
      kind: 'SIGNED',
      version: 2,
    });

    const documentsResponse = await request(httpServer())
      .get(`/contracts/${onboardingContractId}/documents`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(asArray(responseBody(documentsResponse), 'contract document history')).toHaveLength(5);
    await request(httpServer())
      .get(`/contracts/${onboardingContractId}/documents`)
      .set('authorization', `Bearer ${viewerToken}`)
      .expect(403);

    const downloadResponse = await request(httpServer())
      .get(`/contracts/${onboardingContractId}/documents/${onboardingDocumentId}/download`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const download = asRecord(responseBody(downloadResponse));
    expect(download.expiresInSeconds).toBe(300);
    expect(new URL(readString(download, 'url')).searchParams.get('X-Amz-Expires')).toBe('300');

    const contractResponse = await request(httpServer())
      .get(`/contracts/${onboardingContractId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(asRecord(responseBody(contractResponse)).status).toBe('PAYMENT_PENDING');

    await request(httpServer())
      .post(`/contracts/${onboardingContractId}/documents/generate`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(409);
    const documentsAfterSigningResponse = await request(httpServer())
      .get(`/contracts/${onboardingContractId}/documents`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      asArray(responseBody(documentsAfterSigningResponse), 'contract document history'),
    ).toHaveLength(5);
  });

  it('unifies renewal-due and payment-overdue contracts under renewalAttention', async () => {
    const properties = dataSource.getRepository(PropertyUnit);
    const tenants = dataSource.getRepository(Tenant);
    const contracts = dataSource.getRepository(Contract);
    const asOf = dateInSaoPaulo();

    async function activeMonthlyContract(label: string, offset: bigint): Promise<Contract> {
      const property = await properties.save(
        PropertyUnit.create(
          `Renovação ${label} ${suffix}`,
          UnitType.APARTMENT,
          `REN-${label.slice(0, 3)}-${offset}`,
        ),
      );
      const cpf = validCpf((BigInt(numericSeed) + offset).toString());
      const tenant = await tenants.save(
        Tenant.create(
          `Locatária ${label} ${suffix}`,
          formatCpf(cpf),
          `REN${label}${Date.now().toString(36).toUpperCase()}`,
          'Consultora',
          TenantCivilStatus.SINGLE,
          `renovacao.${label}.${suffix}@example.test`,
          `+55 11 9${String(Number(numericSeed) + Number(offset))
            .slice(-8)
            .padStart(8, '0')}`,
        ),
      );
      const contract = Contract.createPendingSignature(
        tenant.id,
        property.id,
        '2026-01-01',
        150_000,
      );
      contract.markSigned();
      contract.activate();
      return contracts.save(contract);
    }

    function paidInvoice(contractId: string, competence: string, periodEnd: string): Invoice {
      const invoice = Invoice.create(contractId, competence, 150_000, `${competence}-05`);
      Object.defineProperty(invoice, '_periodEnd', { value: periodEnd, configurable: true });
      invoice.settleCash(
        150_000,
        new Date(),
        randomUUID(),
        'a'.repeat(64),
        adminId,
        dateInSaoPaulo(),
      );
      return invoice;
    }

    function overdueInvoice(contractId: string, competence: string): Invoice {
      const invoice = Invoice.create(contractId, competence, 150_000, `${competence}-05`);
      invoice.refreshStatus(asOf);
      return invoice;
    }

    function openInvoice(contractId: string, competence: string): Invoice {
      return Invoice.create(contractId, competence, 150_000, `${competence}-05`);
    }

    const renewalOnly = await activeMonthlyContract('renewal', 601n);
    const overdueOnly = await activeMonthlyContract('overdue', 602n);
    const both = await activeMonthlyContract('both', 603n);
    const neither = await activeMonthlyContract('neither', 604n);

    await invoices.save(paidInvoice(renewalOnly.id, '2026-01', asOf));
    await invoices.save(overdueInvoice(overdueOnly.id, '2026-01'));
    await invoices.save(paidInvoice(both.id, '2026-01', asOf));
    await invoices.save(overdueInvoice(both.id, '2026-02'));
    await invoices.save(openInvoice(neither.id, '2027-01'));

    const response = await request(httpServer())
      .get(`/contracts?renewalAttention=true&limit=100&q=${encodeURIComponent(suffix)}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const body = asRecord(responseBody(response));
    const items = asArray(body.data, 'renewalAttention contracts') as Array<
      Record<string, unknown>
    >;
    const ids = items.map((item) => item.id);

    expect(ids).toContain(renewalOnly.id);
    expect(ids).toContain(overdueOnly.id);
    expect(ids).toContain(both.id);
    expect(ids).not.toContain(neither.id);
    expect(ids.filter((id) => id === both.id)).toHaveLength(1);

    const bothItem = items.find((item) => item.id === both.id);
    expect(bothItem?.badges).toEqual(expect.arrayContaining(['RENEWAL_DUE', 'PAYMENT_OVERDUE']));

    const intersectionResponse = await request(httpServer())
      .get(
        `/contracts?renewalAttention=true&badge=PAYMENT_OVERDUE&limit=100&q=${encodeURIComponent(suffix)}`,
      )
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const intersectionIds = asArray(
      asRecord(responseBody(intersectionResponse)).data,
      'intersection contracts',
    ).map((item) => (item as Record<string, unknown>).id);
    expect(intersectionIds).toContain(overdueOnly.id);
    expect(intersectionIds).toContain(both.id);
    expect(intersectionIds).not.toContain(renewalOnly.id);
    expect(intersectionIds).not.toContain(neither.id);

    const legacyBadgeResponse = await request(httpServer())
      .get(`/contracts?badge=RENEWAL_DUE&limit=100&q=${encodeURIComponent(suffix)}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const legacyBadgeIds = asArray(
      asRecord(responseBody(legacyBadgeResponse)).data,
      'legacy badge contracts',
    ).map((item) => (item as Record<string, unknown>).id);
    expect(legacyBadgeIds).toContain(renewalOnly.id);
    expect(legacyBadgeIds).toContain(both.id);
    expect(legacyBadgeIds).not.toContain(overdueOnly.id);
  });

  it('activates a contract explicitly only once its initial invoice is paid through review', async () => {
    const propertyResponse = await request(httpServer())
      .post('/properties')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        neighborhood: `Ativação ${suffix}`,
        type: 'HOUSE',
        unitNumber: `ATIVACAO-${suffix}`,
      })
      .expect(201);
    const activationPropertyId = readString(asRecord(responseBody(propertyResponse)), 'id');

    const draftResponse = await request(httpServer())
      .post('/onboarding-drafts')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ payload: { version: 0, currentStep: 1 } })
      .expect(201);
    const activationDraftId = readString(asRecord(responseBody(draftResponse)), 'id');

    const activationCpf = validCpf((BigInt(numericSeed) + 271n).toString());
    const activationPayload = {
      version: 1,
      currentStep: 5,
      personalData: {
        name: `Locatária Ativação ${suffix}`,
        cpf: formatCpf(activationCpf),
        rg: `ACT${Date.now().toString(36).toUpperCase()}`,
        profession: 'Consultora',
        civilStatus: 'SINGLE',
        email: `ativacao.${suffix}@example.test`,
        mobilePhone: `+55 11 97${String(Date.now()).slice(-7)}`,
      },
      references: [
        {
          name: 'Referência pessoal',
          relationship: 'Amiga',
          phone: `+55 21 95${String(Date.now() + 3).slice(-7)}`,
        },
        {
          name: 'Referência profissional',
          relationship: 'Colega',
          phone: `+55 31 94${String(Date.now() + 4).slice(-7)}`,
        },
      ],
      propertyUnitId: activationPropertyId,
      moveInDate: dateInSaoPaulo(),
      monthlyBaseValueCents: 120_000,
    };
    await request(httpServer())
      .patch(`/onboarding-drafts/${activationDraftId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ payload: activationPayload })
      .expect(200);

    const completionResponse = await request(httpServer())
      .post(`/onboarding-drafts/${activationDraftId}/complete`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const completion = asRecord(responseBody(completionResponse));
    const activationContractId = readString(completion, 'contractId');
    const activationInvoiceId = readString(completion, 'invoiceId');

    await request(httpServer())
      .patch(`/contracts/${activationContractId}/activate`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect('content-type', /application\/problem\+json/)
      .expect(409);

    await request(httpServer())
      .post(`/contracts/${activationContractId}/documents`)
      .set('authorization', `Bearer ${adminToken}`)
      .field('kind', 'SIGNED')
      .attach('document', minimalPdf(), {
        filename: 'activation-signed.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    await request(httpServer())
      .patch(`/contracts/${activationContractId}/activate`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(409);

    const submitResponse = await request(httpServer())
      .post(`/invoices/${activationInvoiceId}/payments`)
      .set('authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', `activation-${suffix}`)
      .field('amountCents', '120000')
      .field('method', 'PIX')
      .field('proofType', 'BANK_STATEMENT')
      .attach('proof', minimalPdf(), {
        filename: 'activation-proof.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const submittedInvoice = asRecord(responseBody(submitResponse));
    const activationPayment = asArray(submittedInvoice.payments, 'submitted payments')
      .map((entry) => asRecord(entry, 'payment'))
      .find((entry) => entry.method === 'PIX');
    if (!activationPayment) throw new Error('Expected the PIX payment to be submitted');
    const activationPaymentId = readString(activationPayment, 'id');

    await request(httpServer())
      .patch(`/contracts/${activationContractId}/activate`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(409);

    await request(httpServer())
      .patch(`/invoices/${activationInvoiceId}/payments/${activationPaymentId}/approve`)
      .set('authorization', `Bearer ${managerToken}`)
      .expect(200);

    const activateResponse = await request(httpServer())
      .patch(`/contracts/${activationContractId}/activate`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(asRecord(responseBody(activateResponse))).toMatchObject({
      id: activationContractId,
      status: 'ACTIVE',
    });

    await request(httpServer())
      .patch(`/contracts/${activationContractId}/activate`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(409);
  });

  it('settles the first invoice directly, emits a receipt, and exposes dashboard aggregates', async () => {
    const idempotencyKey = `onboarding-cash-${suffix}`;
    const settlementResponse = await request(httpServer())
      .post(`/invoices/${onboardingInvoiceId}/settle-cash`)
      .set('authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ amountCents: 175_000 })
      .expect(201);
    const settlement = asRecord(responseBody(settlementResponse));
    onboardingReceiptId = readString(settlement, 'receiptId');
    const settledInvoice = asRecord(settlement.invoice, 'settled invoice');
    const cashPayment = asArray(settledInvoice.payments, 'settled invoice payments')
      .map((entry) => asRecord(entry, 'settled cash payment'))
      .find((entry) => entry.method === 'CASH');
    if (!cashPayment) throw new Error('Direct CASH payment was not returned');
    onboardingPaymentId = readString(cashPayment, 'id');
    expect(settledInvoice).toMatchObject({
      id: onboardingInvoiceId,
      status: 'PAID',
      approvedAmountCents: 175_000,
      outstandingAmountCents: 0,
    });
    expect(cashPayment).toMatchObject({
      status: 'APPROVED',
      isDirectSettlement: true,
      reviewedByUserId: adminId,
    });

    const replayResponse = await request(httpServer())
      .post(`/invoices/${onboardingInvoiceId}/settle-cash`)
      .set('authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ amountCents: 175_000 })
      .expect(201);
    expect(asRecord(responseBody(replayResponse))).toMatchObject({
      receiptId: onboardingReceiptId,
    });
    await request(httpServer())
      .post(`/invoices/${onboardingInvoiceId}/settle-cash`)
      .set('authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ amountCents: 1 })
      .expect(409);

    const lookupResponse = await request(httpServer())
      .get(`/invoices/${onboardingInvoiceId}/payments/by-idempotency-key`)
      .set('authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .expect(200);
    expect(
      asRecord(asRecord(responseBody(lookupResponse)).payment, 'looked up payment'),
    ).toMatchObject({ id: onboardingPaymentId, status: 'APPROVED' });

    const receiptResponse = await request(httpServer())
      .get(`/receipts/${onboardingReceiptId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(asRecord(responseBody(receiptResponse))).toMatchObject({
      id: onboardingReceiptId,
      paymentTransactionId: onboardingPaymentId,
      invoiceId: onboardingInvoiceId,
      contractId: onboardingContractId,
      tenantId: onboardingTenantId,
      amountCents: 175_000,
      paymentMethod: 'CASH',
      voidedAt: null,
    });
    const receiptDownloadResponse = await request(httpServer())
      .get(`/receipts/${onboardingReceiptId}/download`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const receiptDownload = asRecord(responseBody(receiptDownloadResponse));
    const receiptUrl = new URL(readString(receiptDownload, 'url'));
    expect(receiptDownload.expiresInSeconds).toBe(300);
    expect(receiptUrl.searchParams.get('response-content-disposition')).toBe('inline');

    const activeContractResponse = await request(httpServer())
      .get(`/contracts/${onboardingContractId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const activeContract = asRecord(responseBody(activeContractResponse));
    expect(activeContract.status).toBe('ACTIVE');
    expect(typeof activeContract.paidThroughDate).toBe('string');
    expect(typeof activeContract.nextRenewalDate).toBe('string');

    const today = dateInSaoPaulo();
    const dashboardResponse = await request(httpServer())
      .get(`/dashboard/summary?from=${today}&to=${today}`)
      .set('authorization', `Bearer ${viewerToken}`)
      .expect(200);
    const dashboard = asRecord(responseBody(dashboardResponse));
    const financial = asRecord(dashboard.financial, 'dashboard financial summary');
    expect(Number(financial.receivedCents)).toBeGreaterThanOrEqual(175_000);
    expect(asArray(financial.byProperty, 'dashboard property breakdown')).toEqual(
      expect.arrayContaining([expect.objectContaining({ propertyUnitId: onboardingPropertyId })]),
    );
    expect(asArray(financial.byBuilding, 'dashboard building breakdown')).toEqual(
      expect.arrayContaining([expect.objectContaining({ neighborhood: `Onboarding ${suffix}` })]),
    );
    const todayPoint = asArray(financial.daily, 'dashboard daily series')
      .map((entry) => asRecord(entry, 'dashboard daily point'))
      .find((entry) => entry.date === today);
    expect(Number(todayPoint?.receivedCents ?? 0)).toBeGreaterThanOrEqual(175_000);

    await request(httpServer())
      .get('/dashboard/summary?from=2026-08-01&to=2026-07-01')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(422);
    await request(httpServer())
      .get(`/contracts/export.csv?q=${encodeURIComponent(`Onboarding ${suffix}`)}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect('content-type', /text\/csv/)
      .expect(200);
    await request(httpServer())
      .get(`/invoices/export.csv?contractId=${onboardingContractId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect('content-type', /text\/csv/)
      .expect(200);
  });

  it('closes, protects, reopens, and reconciles a CASH day before allowing reversal', async () => {
    await dataSource.query(`UPDATE payment_transactions SET reviewed_at = $1 WHERE id = $2`, [
      `${isolatedCashboxDate}T12:00:00-03:00`,
      onboardingPaymentId,
    ]);

    await request(httpServer())
      .get(`/cash-closings/${isolatedCashboxDate}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(404);
    const closeResponse = await request(httpServer())
      .post(`/cash-closings/${isolatedCashboxDate}`)
      .set('authorization', `Bearer ${managerToken}`)
      .send({ countedCashCents: 175_000 })
      .expect(200);
    expect(asRecord(responseBody(closeResponse))).toMatchObject({
      closingDate: isolatedCashboxDate,
      expectedCashCents: 175_000,
      countedCashCents: 175_000,
      differenceCents: 0,
      status: 'CLOSED',
      closedBy: managerId,
    });

    await request(httpServer())
      .post(`/cash-closings/${isolatedCashboxDate}`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ countedCashCents: 175_000 })
      .expect(409);
    const blockedReversal = await request(httpServer())
      .patch(`/invoices/${onboardingInvoiceId}/payments/${onboardingPaymentId}/reverse`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Tentativa durante caixa fechado.' })
      .expect(409);
    expect(asRecord(responseBody(blockedReversal)).detail).toContain(
      'caixa deste dia está fechado',
    );

    const rangedListResponse = await request(httpServer())
      .get(`/cash-closings?from=${isolatedCashboxDate}&to=${isolatedCashboxDate}`)
      .set('authorization', `Bearer ${managerToken}`)
      .expect(200);
    expect(asArray(responseBody(rangedListResponse), 'cash closing range')).toHaveLength(1);
    await request(httpServer())
      .get(`/cash-closings?from=${isolatedCashboxDate}`)
      .set('authorization', `Bearer ${managerToken}`)
      .expect(200);
    await request(httpServer())
      .get(`/cash-closings?to=${isolatedCashboxDate}`)
      .set('authorization', `Bearer ${managerToken}`)
      .expect(200);
    await request(httpServer())
      .get(`/cash-closings/${isolatedCashboxDate}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    await request(httpServer())
      .get('/cash-closings?from=2026-08-01&to=2026-07-01')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(422);

    await request(httpServer())
      .post(`/cash-closings/${isolatedCashboxDate}/reopen`)
      .set('authorization', `Bearer ${managerToken}`)
      .send({ reason: 'Gestor não pode reabrir.' })
      .expect(403);
    const reopenResponse = await request(httpServer())
      .post(`/cash-closings/${isolatedCashboxDate}/reopen`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Contagem será conferida novamente.' })
      .expect(200);
    expect(asRecord(responseBody(reopenResponse))).toMatchObject({
      status: 'REOPENED',
      reopenedBy: adminId,
      reopenReason: 'Contagem será conferida novamente.',
    });
    await request(httpServer())
      .post(`/cash-closings/${isolatedCashboxDate}/reopen`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Reabertura repetida.' })
      .expect(409);

    const closeAgainResponse = await request(httpServer())
      .post(`/cash-closings/${isolatedCashboxDate}`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ countedCashCents: 174_000 })
      .expect(200);
    expect(asRecord(responseBody(closeAgainResponse))).toMatchObject({
      status: 'CLOSED',
      expectedCashCents: 175_000,
      countedCashCents: 174_000,
      differenceCents: -1000,
      closedBy: adminId,
    });
    await request(httpServer())
      .post(`/cash-closings/${isolatedCashboxDate}/reopen`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Liberar estorno auditado.' })
      .expect(200);

    const reversalResponse = await request(httpServer())
      .patch(`/invoices/${onboardingInvoiceId}/payments/${onboardingPaymentId}/reverse`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Pagamento lançado na fatura incorreta.' })
      .expect(200);
    const reversedInvoice = asRecord(responseBody(reversalResponse));
    const reversedPayment = asArray(reversedInvoice.payments, 'reversed invoice payments')
      .map((entry) => asRecord(entry, 'reversed payment'))
      .find((entry) => entry.id === onboardingPaymentId);
    expect(reversedPayment).toMatchObject({
      status: 'REVERSED',
      reversalReason: 'Pagamento lançado na fatura incorreta.',
      reversedByUserId: adminId,
    });

    const voidedReceiptResponse = await request(httpServer())
      .get(`/receipts/${onboardingReceiptId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const voidedReceipt = asRecord(responseBody(voidedReceiptResponse));
    expect(voidedReceipt.voidedReason).toBe('Pagamento lançado na fatura incorreta.');
    expect(typeof voidedReceipt.voidedAt).toBe('string');

    const reconciledResponse = await request(httpServer())
      .post(`/cash-closings/${isolatedCashboxDate}`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ countedCashCents: 0 })
      .expect(200);
    expect(asRecord(responseBody(reconciledResponse))).toMatchObject({
      expectedCashCents: 0,
      countedCashCents: 0,
      differenceCents: 0,
      status: 'CLOSED',
    });
    await request(httpServer())
      .post(`/cash-closings/${isolatedCashboxDate}/reopen`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Estado final isolado do teste E2E.' })
      .expect(200);
  });

  it('finishes the monthly contract lifecycle after the reversed initial settlement', async () => {
    const endingResponse = await request(httpServer())
      .patch(`/contracts/${onboardingContractId}/schedule-ending`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Encerramento solicitado no teste E2E.' })
      .expect(200);
    expect(asRecord(responseBody(endingResponse))).toMatchObject({
      status: 'ENDING',
      statusReason: 'Encerramento solicitado no teste E2E.',
    });

    const terminatedResponse = await request(httpServer())
      .patch(`/contracts/${onboardingContractId}/terminate`)
      .set('authorization', `Bearer ${managerToken}`)
      .send({ reason: 'Vistoria concluída.' })
      .expect(200);
    expect(asRecord(responseBody(terminatedResponse))).toMatchObject({
      status: 'TERMINATED',
      statusReason: 'Vistoria concluída.',
    });

    const propertyResponse = await request(httpServer())
      .get(`/properties/${onboardingPropertyId}`)
      .set('authorization', `Bearer ${viewerToken}`)
      .expect(200);
    expect(asRecord(responseBody(propertyResponse)).occupied).toBe(false);
  });
});
