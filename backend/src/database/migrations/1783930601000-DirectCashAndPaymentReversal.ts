import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectCashAndPaymentReversal1783930601000 implements MigrationInterface {
  name = 'DirectCashAndPaymentReversal1783930601000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD "is_direct_settlement" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD "reversal_reason" character varying(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD "reversed_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(`ALTER TABLE "payment_transactions" ADD "reversed_by_user_id" uuid`);
    await queryRunner.query(`
      ALTER TABLE "payment_transactions"
      ADD CONSTRAINT "FK_payment_transactions_reversed_by_user"
      FOREIGN KEY ("reversed_by_user_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE RESTRICT
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_transactions_reversed_by_user_id" ON "payment_transactions" ("reversed_by_user_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "CHK_payment_transactions_review_state"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "CHK_payment_transactions_distinct_actors"`,
    );
    await queryRunner.query(`
      ALTER TABLE "payment_transactions"
      ADD CONSTRAINT "CHK_payment_transactions_review_state" CHECK (
        (status::text = 'SUBMITTED' AND reviewed_at IS NULL AND rejection_reason IS NULL
          AND reversed_at IS NULL AND reversal_reason IS NULL AND reversed_by_user_id IS NULL)
        OR (status::text = 'APPROVED' AND reviewed_at IS NOT NULL AND rejection_reason IS NULL
          AND reversed_at IS NULL AND reversal_reason IS NULL AND reversed_by_user_id IS NULL)
        OR (status::text = 'REJECTED' AND reviewed_at IS NOT NULL
          AND rejection_reason IS NOT NULL AND char_length(trim(rejection_reason)) > 0
          AND reversed_at IS NULL AND reversal_reason IS NULL AND reversed_by_user_id IS NULL)
        OR (status::text = 'REVERSED' AND reviewed_at IS NOT NULL AND rejection_reason IS NULL
          AND reversed_at IS NOT NULL AND reversal_reason IS NOT NULL
          AND char_length(trim(reversal_reason)) > 0 AND reversed_by_user_id IS NOT NULL)
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_transactions"
      ADD CONSTRAINT "CHK_payment_transactions_direct_settlement" CHECK (
        NOT is_direct_settlement OR (
          method::text = 'CASH'
          AND status::text IN ('APPROVED', 'REVERSED')
          AND submitted_by_user_id IS NOT NULL
          AND reviewed_by_user_id = submitted_by_user_id
        )
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_transactions"
      ADD CONSTRAINT "CHK_payment_transactions_distinct_actors" CHECK (
        reviewed_by_user_id IS NULL OR submitted_by_user_id IS NULL
        OR reviewed_by_user_id <> submitted_by_user_id OR is_direct_settlement
      )
    `);

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
          OR OLD.request_fingerprint <> NEW.request_fingerprint
          OR OLD.is_direct_settlement <> NEW.is_direct_settlement THEN
          RAISE EXCEPTION 'immutable payment fields cannot be changed';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_payment_ledger_invariants() RETURNS trigger AS $$
      DECLARE
        invoice_total integer;
        reserved_total bigint;
      BEGIN
        IF TG_OP = 'UPDATE'
          AND OLD.status <> NEW.status
          AND NOT (
            (OLD.status::text = 'SUBMITTED' AND NEW.status::text IN ('APPROVED', 'REJECTED'))
            OR (OLD.status::text = 'APPROVED' AND NEW.status::text = 'REVERSED')
          ) THEN
          RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'invalid payment status transition';
        END IF;

        SELECT total_value_cents INTO invoice_total
          FROM invoices WHERE id = NEW.invoice_id FOR UPDATE;
        SELECT COALESCE(SUM(amount_cents), 0) INTO reserved_total
          FROM payment_transactions
          WHERE invoice_id = NEW.invoice_id AND id <> NEW.id
            AND status::text NOT IN ('REJECTED', 'REVERSED');
        IF NEW.status::text NOT IN ('REJECTED', 'REVERSED') THEN
          reserved_total := reserved_total + NEW.amount_cents;
        END IF;
        IF invoice_total IS NOT NULL AND reserved_total > invoice_total THEN
          RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'payment total exceeds invoice total';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION recalculate_invoice_status_from_ledger() RETURNS trigger AS $$
      DECLARE
        approved_total bigint;
        has_submitted boolean;
        invoice_total integer;
        invoice_due_date date;
        expected_status invoice_status;
      BEGIN
        SELECT total_value_cents, due_date INTO invoice_total, invoice_due_date
          FROM invoices WHERE id = NEW.invoice_id FOR UPDATE;
        SELECT
          COALESCE(SUM(amount_cents) FILTER (WHERE status::text = 'APPROVED'), 0),
          COALESCE(BOOL_OR(status::text = 'SUBMITTED'), false)
          INTO approved_total, has_submitted
          FROM payment_transactions WHERE invoice_id = NEW.invoice_id;
        expected_status := CASE
          WHEN approved_total = invoice_total THEN 'PAID'::invoice_status
          WHEN has_submitted THEN 'UNDER_REVIEW'::invoice_status
          WHEN approved_total > 0 THEN 'PARTIALLY_PAID'::invoice_status
          WHEN invoice_due_date < CURRENT_DATE THEN 'OVERDUE'::invoice_status
          ELSE 'OPEN'::invoice_status
        END;
        UPDATE invoices SET status = expected_status, updated_at = now()
          WHERE id = NEW.invoice_id AND status IS DISTINCT FROM expected_status;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION verify_invoice_ledger_status() RETURNS trigger AS $$
      DECLARE
        approved_total bigint;
        has_submitted boolean;
        invoice_total integer;
        current_status invoice_status;
      BEGIN
        SELECT total_value_cents, status INTO invoice_total, current_status
          FROM invoices WHERE id = NEW.id;
        SELECT
          COALESCE(SUM(amount_cents) FILTER (WHERE status::text = 'APPROVED'), 0),
          COALESCE(BOOL_OR(status::text = 'SUBMITTED'), false)
          INTO approved_total, has_submitted
          FROM payment_transactions WHERE invoice_id = NEW.id;
        IF (approved_total = invoice_total AND current_status <> 'PAID'::invoice_status)
          OR (approved_total < invoice_total AND has_submitted
              AND current_status <> 'UNDER_REVIEW'::invoice_status)
          OR (approved_total > 0 AND approved_total < invoice_total AND NOT has_submitted
              AND current_status <> 'PARTIALLY_PAID'::invoice_status)
          OR (approved_total = 0 AND NOT has_submitted
              AND current_status NOT IN ('OPEN'::invoice_status, 'OVERDUE'::invoice_status)) THEN
          RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'invoice status is inconsistent with its payment ledger';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION create_payment_notifications() RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'INSERT' AND NEW.status::text = 'SUBMITTED'
          AND NEW.submitted_by_user_id IS NOT NULL THEN
          INSERT INTO notifications (user_id, type, title, message, resource_type, resource_id)
          SELECT users.id, 'PAYMENT_SUBMITTED', 'Pagamento aguardando revisão',
            'Um pagamento foi submetido e precisa ser revisado.', 'INVOICE', NEW.invoice_id
          FROM users
          WHERE users.active = true
            AND users.role IN ('ADMIN'::user_role, 'MANAGER'::user_role)
            AND users.id <> NEW.submitted_by_user_id;
        ELSIF TG_OP = 'UPDATE' AND OLD.status::text = 'SUBMITTED'
          AND NEW.status::text IN ('APPROVED', 'REJECTED')
          AND NEW.submitted_by_user_id IS NOT NULL THEN
          INSERT INTO notifications (user_id, type, title, message, resource_type, resource_id)
          VALUES (
            NEW.submitted_by_user_id,
            CASE WHEN NEW.status::text = 'APPROVED' THEN 'PAYMENT_APPROVED' ELSE 'PAYMENT_REJECTED' END,
            CASE WHEN NEW.status::text = 'APPROVED' THEN 'Pagamento aprovado' ELSE 'Pagamento rejeitado' END,
            CASE WHEN NEW.status::text = 'APPROVED'
              THEN 'O pagamento submetido por você foi aprovado.'
              ELSE 'O pagamento submetido por você foi rejeitado.' END,
            'INVOICE', NEW.invoice_id
          );
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER "TR_payment_transactions_ledger_invariants" ON "payment_transactions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DISABLE TRIGGER "TR_payment_transactions_immutable_fields"`,
    );
    await queryRunner.query(`
      UPDATE "payment_transactions"
      SET "status" = 'SUBMITTED'::"payment_status",
          "reviewed_at" = NULL,
          "reviewed_by_user_id" = NULL,
          "rejection_reason" = NULL,
          "reversal_reason" = NULL,
          "reversed_at" = NULL,
          "reversed_by_user_id" = NULL,
          "is_direct_settlement" = false
      WHERE "is_direct_settlement" = true
    `);
    await queryRunner.query(`
      UPDATE "payment_transactions"
      SET "status" = 'APPROVED'::"payment_status",
          "reversal_reason" = NULL,
          "reversed_at" = NULL,
          "reversed_by_user_id" = NULL
      WHERE "status"::text = 'REVERSED'
    `);

    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "CHK_payment_transactions_direct_settlement"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "CHK_payment_transactions_distinct_actors"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "CHK_payment_transactions_review_state"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_payment_transactions_reversed_by_user_id"`);
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_payment_transactions_reversed_by_user"`,
    );
    await queryRunner.query(`ALTER TABLE "payment_transactions" DROP COLUMN "reversed_by_user_id"`);
    await queryRunner.query(`ALTER TABLE "payment_transactions" DROP COLUMN "reversed_at"`);
    await queryRunner.query(`ALTER TABLE "payment_transactions" DROP COLUMN "reversal_reason"`);
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP COLUMN "is_direct_settlement"`,
    );
    await queryRunner.query(`
      ALTER TABLE "payment_transactions"
      ADD CONSTRAINT "CHK_payment_transactions_review_state" CHECK (
        (status = 'SUBMITTED'::payment_status AND reviewed_at IS NULL AND rejection_reason IS NULL)
        OR (status = 'APPROVED'::payment_status AND reviewed_at IS NOT NULL AND rejection_reason IS NULL)
        OR (status = 'REJECTED'::payment_status AND reviewed_at IS NOT NULL
          AND rejection_reason IS NOT NULL AND char_length(trim(rejection_reason)) > 0)
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_transactions"
      ADD CONSTRAINT "CHK_payment_transactions_distinct_actors" CHECK (
        reviewed_by_user_id IS NULL OR submitted_by_user_id IS NULL
        OR reviewed_by_user_id <> submitted_by_user_id
      )
    `);

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
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ENABLE TRIGGER "TR_payment_transactions_immutable_fields"`,
    );
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_payment_ledger_invariants() RETURNS trigger AS $$
      DECLARE invoice_total integer; reserved_total bigint;
      BEGIN
        IF TG_OP = 'UPDATE' AND OLD.status <> NEW.status
          AND NOT (OLD.status = 'SUBMITTED'::payment_status
            AND NEW.status IN ('APPROVED'::payment_status, 'REJECTED'::payment_status)) THEN
          RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'invalid payment status transition';
        END IF;
        SELECT total_value_cents INTO invoice_total FROM invoices
          WHERE id = NEW.invoice_id FOR UPDATE;
        SELECT COALESCE(SUM(amount_cents), 0) INTO reserved_total
          FROM payment_transactions WHERE invoice_id = NEW.invoice_id
            AND id <> NEW.id AND status <> 'REJECTED'::payment_status;
        IF NEW.status <> 'REJECTED'::payment_status THEN
          reserved_total := reserved_total + NEW.amount_cents;
        END IF;
        IF invoice_total IS NOT NULL AND reserved_total > invoice_total THEN
          RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'payment total exceeds invoice total';
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
      CREATE OR REPLACE FUNCTION recalculate_invoice_status_from_ledger() RETURNS trigger AS $$
      DECLARE approved_total bigint; has_submitted boolean; invoice_total integer;
        invoice_due_date date; expected_status invoice_status;
      BEGIN
        SELECT total_value_cents, due_date INTO invoice_total, invoice_due_date
          FROM invoices WHERE id = NEW.invoice_id FOR UPDATE;
        SELECT
          COALESCE(SUM(amount_cents) FILTER (WHERE status = 'APPROVED'::payment_status), 0),
          COALESCE(BOOL_OR(status = 'SUBMITTED'::payment_status), false)
          INTO approved_total, has_submitted FROM payment_transactions
          WHERE invoice_id = NEW.invoice_id;
        expected_status := CASE
          WHEN approved_total = invoice_total THEN 'PAID'::invoice_status
          WHEN has_submitted THEN 'UNDER_REVIEW'::invoice_status
          WHEN approved_total > 0 THEN 'PARTIALLY_PAID'::invoice_status
          WHEN invoice_due_date < CURRENT_DATE THEN 'OVERDUE'::invoice_status
          ELSE 'OPEN'::invoice_status END;
        UPDATE invoices SET status = expected_status, updated_at = now()
          WHERE id = NEW.invoice_id AND status IS DISTINCT FROM expected_status;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION create_payment_notifications() RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'INSERT' AND NEW.submitted_by_user_id IS NOT NULL THEN
          INSERT INTO notifications (user_id, type, title, message, resource_type, resource_id)
          SELECT users.id, 'PAYMENT_SUBMITTED', 'Pagamento aguardando revisão',
            'Um pagamento foi submetido e precisa ser revisado.', 'INVOICE', NEW.invoice_id
          FROM users WHERE users.active = true
            AND users.role IN ('ADMIN'::user_role, 'MANAGER'::user_role)
            AND users.id <> NEW.submitted_by_user_id;
        ELSIF TG_OP = 'UPDATE' AND OLD.status = 'SUBMITTED'::payment_status
          AND NEW.status IN ('APPROVED'::payment_status, 'REJECTED'::payment_status)
          AND NEW.submitted_by_user_id IS NOT NULL THEN
          INSERT INTO notifications (user_id, type, title, message, resource_type, resource_id)
          VALUES (
            NEW.submitted_by_user_id,
            CASE WHEN NEW.status = 'APPROVED'::payment_status THEN 'PAYMENT_APPROVED' ELSE 'PAYMENT_REJECTED' END,
            CASE WHEN NEW.status = 'APPROVED'::payment_status THEN 'Pagamento aprovado' ELSE 'Pagamento rejeitado' END,
            CASE WHEN NEW.status = 'APPROVED'::payment_status
              THEN 'O pagamento submetido por você foi aprovado.'
              ELSE 'O pagamento submetido por você foi rejeitado.' END,
            'INVOICE', NEW.invoice_id
          );
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
  }
}
