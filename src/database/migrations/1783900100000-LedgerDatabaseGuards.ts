import { MigrationInterface, QueryRunner } from 'typeorm';

export class LedgerDatabaseGuards1783900100000 implements MigrationInterface {
  name = 'LedgerDatabaseGuards1783900100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_payment_immutable_fields() RETURNS trigger AS $$
      BEGIN
        IF OLD.invoice_id <> NEW.invoice_id
          OR OLD.amount_cents <> NEW.amount_cents
          OR OLD.submitted_at <> NEW.submitted_at
          OR OLD.method <> NEW.method
          OR OLD.proof_type IS DISTINCT FROM NEW.proof_type
          OR OLD.proof_reference IS DISTINCT FROM NEW.proof_reference
          OR OLD.idempotency_key <> NEW.idempotency_key
          OR OLD.request_fingerprint <> NEW.request_fingerprint THEN
          RAISE EXCEPTION 'immutable payment fields cannot be changed';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE FUNCTION enforce_payment_ledger_invariants() RETURNS trigger AS $$
      DECLARE
        invoice_total integer;
        reserved_total bigint;
      BEGIN
        IF TG_OP = 'UPDATE'
          AND OLD.status <> NEW.status
          AND NOT (
            OLD.status = 'SUBMITTED'::payment_status
            AND NEW.status IN ('APPROVED'::payment_status, 'REJECTED'::payment_status)
          ) THEN
          RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'invalid payment status transition';
        END IF;

        SELECT total_value_cents
          INTO invoice_total
          FROM invoices
          WHERE id = NEW.invoice_id
          FOR UPDATE;

        SELECT COALESCE(SUM(amount_cents), 0)
          INTO reserved_total
          FROM payment_transactions
          WHERE invoice_id = NEW.invoice_id
            AND id <> NEW.id
            AND status <> 'REJECTED'::payment_status;

        IF NEW.status <> 'REJECTED'::payment_status THEN
          reserved_total := reserved_total + NEW.amount_cents;
        END IF;

        IF invoice_total IS NOT NULL AND reserved_total > invoice_total THEN
          RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'payment total exceeds invoice total';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TR_payment_transactions_ledger_invariants"
      BEFORE INSERT OR UPDATE ON "payment_transactions"
      FOR EACH ROW EXECUTE FUNCTION enforce_payment_ledger_invariants()
    `);

    await queryRunner.query(`
      CREATE FUNCTION audit_financial_ledger_change() RETURNS trigger AS $$
      DECLARE
        entry_metadata jsonb;
      BEGIN
        entry_metadata := jsonb_build_object(
          'source', 'database-trigger',
          'operation', TG_OP,
          'newStatus', NEW.status::text
        );
        IF TG_OP = 'UPDATE' THEN
          entry_metadata := entry_metadata || jsonb_build_object('oldStatus', OLD.status::text);
        END IF;

        INSERT INTO audit_logs (action, resource_type, resource_id, metadata)
        VALUES (
          'DB ' || TG_OP,
          TG_TABLE_NAME,
          NEW.id,
          entry_metadata
        );
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TR_invoices_durable_audit"
      AFTER INSERT OR UPDATE ON "invoices"
      FOR EACH ROW EXECUTE FUNCTION audit_financial_ledger_change()
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TR_payment_transactions_durable_audit"
      AFTER INSERT OR UPDATE ON "payment_transactions"
      FOR EACH ROW EXECUTE FUNCTION audit_financial_ledger_change()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER "TR_payment_transactions_durable_audit" ON "payment_transactions"`,
    );
    await queryRunner.query(`DROP TRIGGER "TR_invoices_durable_audit" ON "invoices"`);
    await queryRunner.query(`DROP FUNCTION audit_financial_ledger_change()`);
    await queryRunner.query(
      `DROP TRIGGER "TR_payment_transactions_ledger_invariants" ON "payment_transactions"`,
    );
    await queryRunner.query(`DROP FUNCTION enforce_payment_ledger_invariants()`);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_payment_immutable_fields() RETURNS trigger AS $$
      BEGIN
        IF OLD.invoice_id <> NEW.invoice_id
          OR OLD.amount_cents <> NEW.amount_cents
          OR OLD.submitted_at <> NEW.submitted_at
          OR OLD.method <> NEW.method
          OR OLD.proof_type IS DISTINCT FROM NEW.proof_type
          OR OLD.proof_reference IS DISTINCT FROM NEW.proof_reference THEN
          RAISE EXCEPTION 'immutable payment fields cannot be changed';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
  }
}
