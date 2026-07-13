import { hash } from 'bcryptjs';
import dataSource from '../../src/database/data-source';

const ids = {
  admin: '10000000-0000-4000-8000-000000000001',
  manager: '10000000-0000-4000-8000-000000000002',
  viewer: '10000000-0000-4000-8000-000000000003',
  tenant: '20000000-0000-4000-8000-000000000001',
  property: '30000000-0000-4000-8000-000000000001',
  contract: '40000000-0000-4000-8000-000000000001',
  openInvoice: '50000000-0000-4000-8000-000000000001',
  reviewInvoice: '50000000-0000-4000-8000-000000000002',
  reviewPayment: '60000000-0000-4000-8000-000000000001',
} as const;

const password = process.env.E2E_TEST_PASSWORD ?? 'Fullstack-E2E-Password-123!';

function assertSafeEnvironment(): void {
  if (process.env.NODE_ENV !== 'test' || process.env.E2E_INTEGRATION !== '1') {
    throw new Error('O seed full-stack exige NODE_ENV=test e E2E_INTEGRATION=1.');
  }
  const database = process.env.DB_DATABASE ?? '';
  if (!/^tenancyledger(?:_[a-z0-9]+)*_e2e(?:_[a-z0-9]+)*$/i.test(database)) {
    throw new Error('O seed só pode limpar um banco tenancyledger_*_e2e[_*] exclusivo.');
  }
}

async function seed(): Promise<void> {
  assertSafeEnvironment();
  await dataSource.initialize();
  const passwordHash = await hash(password, 12);

  await dataSource.transaction(async (manager) => {
    await manager.query(`
      TRUNCATE TABLE
        audit_logs,
        notifications,
        refresh_sessions,
        payment_transactions,
        invoices,
        contracts,
        property_units,
        tenants,
        users
      RESTART IDENTITY CASCADE
    `);

    await manager.query(
      `
        INSERT INTO users (id, email, password_hash, role, active, token_version, created_at, updated_at)
        VALUES
          ($1, 'admin.e2e@example.test', $4, 'ADMIN', true, 0, '2026-01-01T09:00:00Z', '2026-01-01T09:00:00Z'),
          ($2, 'manager.e2e@example.test', $4, 'MANAGER', true, 0, '2026-01-01T09:01:00Z', '2026-01-01T09:01:00Z'),
          ($3, 'viewer.e2e@example.test', $4, 'VIEWER', true, 0, '2026-01-01T09:02:00Z', '2026-01-01T09:02:00Z')
      `,
      [ids.admin, ids.manager, ids.viewer, passwordHash],
    );

    await manager.query(
      `
        INSERT INTO tenants
          (id, cpf, rg, profession, civil_status, email, mobile_phone, created_at, updated_at)
        VALUES
          ($1, '16899535009', 'E2E-SEED-01', 'Locatário Seed E2E', 'SINGLE',
           'tenant.seed.e2e@example.test', '11999990001',
           '2026-01-01T10:00:00Z', '2026-01-01T10:00:00Z')
      `,
      [ids.tenant],
    );

    await manager.query(
      `
        INSERT INTO property_units (id, neighborhood, type, unit_number, created_at)
        VALUES ($1, 'Bairro Seed E2E', 'APARTMENT', 'E2E-101', '2026-01-01T10:01:00Z')
      `,
      [ids.property],
    );

    await manager.query(
      `
        INSERT INTO contracts
          (id, tenant_id, property_unit_id, move_in_date, end_date,
           monthly_base_value_cents, duration_in_months, billing_day,
           is_renewable, status, created_at, updated_at)
        VALUES
          ($1, $2, $3, '2099-01-01', '2100-12-31', 250000, 24, 10,
           true, 'ACTIVE', '2026-01-01T10:02:00Z', '2026-01-01T10:02:00Z')
      `,
      [ids.contract, ids.tenant, ids.property],
    );

    await manager.query(
      `
        INSERT INTO invoices
          (id, contract_id, competence, total_value_cents, due_date, status, created_at, updated_at)
        VALUES
          ($1, $3, '2099-01', 250000, '2099-01-10', 'OPEN',
           '2026-01-01T10:03:00Z', '2026-01-01T10:03:00Z'),
          ($2, $3, '2099-02', 250000, '2099-02-10', 'UNDER_REVIEW',
           '2026-01-01T10:04:00Z', '2026-01-01T10:04:00Z')
      `,
      [ids.openInvoice, ids.reviewInvoice, ids.contract],
    );

    await manager.query(
      `
        INSERT INTO payment_transactions
          (id, invoice_id, amount_cents, submitted_at, proof_reference, method,
           proof_type, status, reviewed_at, rejection_reason, idempotency_key,
           request_fingerprint, submitted_by_user_id, reviewed_by_user_id)
        VALUES
          ($1, $2, 50000, '2026-01-01T10:05:00Z', NULL, 'CASH', NULL,
           'SUBMITTED', NULL, NULL, 'seed-review-payment-0001',
           repeat('a', 64), $3, NULL)
      `,
      [ids.reviewPayment, ids.reviewInvoice, ids.manager],
    );
  });

  console.log(
    JSON.stringify({
      seeded: true,
      users: ['admin.e2e@example.test', 'manager.e2e@example.test', 'viewer.e2e@example.test'],
      openInvoiceId: ids.openInvoice,
      reviewInvoiceId: ids.reviewInvoice,
    }),
  );
}

seed()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Falha desconhecida ao preparar E2E.');
    process.exitCode = 1;
  })
  .finally(async () => {
    if (dataSource.isInitialized) await dataSource.destroy();
  });
