import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { User, UserRole } from '../src/contexts/auth/domain/entities/user.entity';
import { Invoice } from '../src/contexts/invoice/domain/entities/invoice.entity';
import { InvoiceGenerationWorker } from '../src/contexts/invoice/infrastructure/workers/invoice-generation.worker';
import { AuditLog } from '../src/core/infrastructure/audit/audit-log.entity';

interface TenantInput {
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

  const suffix = uniqueSuffix();
  const numericSeed = `${Date.now()}${process.pid}`.replace(/\D/g, '').slice(-9);
  const tenantCpf = validCpf(numericSeed);
  const tenantInput: TenantInput = {
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

  it('creates a tenant with minimized and masked personal data', async () => {
    const response = await request(httpServer())
      .post('/tenants')
      .set('authorization', `Bearer ${adminToken}`)
      .set('x-request-id', successfulTenantRequestId)
      .send(tenantInput)
      .expect(201);
    const body = asRecord(responseBody(response));

    tenantId = readString(body, 'id');
    expect(body).toMatchObject({
      cpf: `***.***.***-${tenantCpf.slice(-2)}`,
      profession: tenantInput.profession,
      civilStatus: tenantInput.civilStatus,
      email: 'e***@example.test',
      mobilePhone: `(**) *****-${tenantInput.mobilePhone.slice(-4)}`,
    });
    expect(body).not.toHaveProperty('rg');
    expect(JSON.stringify(body)).not.toContain(tenantInput.rg);
    expect(JSON.stringify(body)).not.toContain(tenantCpf);
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

  it('paginates tenants without exposing unmasked fields', async () => {
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

  it('creates a property unit and an active contract', async () => {
    const propertyResponse = await request(httpServer())
      .post('/properties')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        neighborhood: `E2E-${suffix}`,
        type: 'APARTMENT',
        unitNumber: `UNIT-${suffix}`,
      })
      .expect(201);
    propertyId = readString(asRecord(responseBody(propertyResponse)), 'id');

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
});
