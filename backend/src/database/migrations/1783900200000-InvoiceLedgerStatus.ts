import { MigrationInterface, QueryRunner } from 'typeorm';

export class InvoiceLedgerStatus1783900200000 implements MigrationInterface {
  name = 'InvoiceLedgerStatus1783900200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION recalculate_invoice_status_from_ledger() RETURNS trigger AS $$
      DECLARE
        approved_total bigint;
        has_submitted boolean;
        invoice_total integer;
        invoice_due_date date;
        expected_status invoice_status;
      BEGIN
        SELECT total_value_cents, due_date
          INTO invoice_total, invoice_due_date
          FROM invoices
          WHERE id = NEW.invoice_id
          FOR UPDATE;

        SELECT
          COALESCE(SUM(amount_cents) FILTER (WHERE status = 'APPROVED'::payment_status), 0),
          COALESCE(BOOL_OR(status = 'SUBMITTED'::payment_status), false)
          INTO approved_total, has_submitted
          FROM payment_transactions
          WHERE invoice_id = NEW.invoice_id;

        expected_status := CASE
          WHEN approved_total = invoice_total THEN 'PAID'::invoice_status
          WHEN has_submitted THEN 'UNDER_REVIEW'::invoice_status
          WHEN approved_total > 0 THEN 'PARTIALLY_PAID'::invoice_status
          WHEN invoice_due_date < CURRENT_DATE THEN 'OVERDUE'::invoice_status
          ELSE 'OPEN'::invoice_status
        END;

        UPDATE invoices
          SET status = expected_status, updated_at = now()
          WHERE id = NEW.invoice_id AND status IS DISTINCT FROM expected_status;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TR_payment_transactions_recalculate_invoice"
      AFTER INSERT OR UPDATE OF status ON "payment_transactions"
      FOR EACH ROW EXECUTE FUNCTION recalculate_invoice_status_from_ledger()
    `);

    await queryRunner.query(`
      CREATE FUNCTION verify_invoice_ledger_status() RETURNS trigger AS $$
      DECLARE
        approved_total bigint;
        has_submitted boolean;
        invoice_total integer;
        current_status invoice_status;
      BEGIN
        SELECT total_value_cents, status
          INTO invoice_total, current_status
          FROM invoices
          WHERE id = NEW.id;

        SELECT
          COALESCE(SUM(amount_cents) FILTER (WHERE status = 'APPROVED'::payment_status), 0),
          COALESCE(BOOL_OR(status = 'SUBMITTED'::payment_status), false)
          INTO approved_total, has_submitted
          FROM payment_transactions
          WHERE invoice_id = NEW.id;

        IF (approved_total = invoice_total AND current_status <> 'PAID'::invoice_status)
          OR (approved_total < invoice_total AND has_submitted
              AND current_status <> 'UNDER_REVIEW'::invoice_status)
          OR (approved_total > 0 AND approved_total < invoice_total AND NOT has_submitted
              AND current_status <> 'PARTIALLY_PAID'::invoice_status)
          OR (approved_total = 0 AND NOT has_submitted
              AND current_status NOT IN ('OPEN'::invoice_status, 'OVERDUE'::invoice_status)) THEN
          RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'invoice status is inconsistent with its payment ledger';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE CONSTRAINT TRIGGER "TR_invoices_ledger_status"
      AFTER INSERT OR UPDATE ON "invoices"
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION verify_invoice_ledger_status()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER "TR_invoices_ledger_status" ON "invoices"`);
    await queryRunner.query(`DROP FUNCTION verify_invoice_ledger_status()`);
    await queryRunner.query(
      `DROP TRIGGER "TR_payment_transactions_recalculate_invoice" ON "payment_transactions"`,
    );
    await queryRunner.query(`DROP FUNCTION recalculate_invoice_status_from_ledger()`);
  }
}
