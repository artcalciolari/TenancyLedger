import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCashClosings1783941900000 implements MigrationInterface {
  name = 'CreateCashClosings1783941900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "cash_closing_status" AS ENUM ('CLOSED', 'REOPENED')`);
    await queryRunner.query(`
      CREATE TABLE "cash_closings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "closing_date" date NOT NULL,
        "expected_cash_cents" integer NOT NULL,
        "counted_cash_cents" integer NOT NULL,
        "difference_cents" integer GENERATED ALWAYS AS
          (counted_cash_cents - expected_cash_cents) STORED,
        "status" "cash_closing_status" NOT NULL DEFAULT 'CLOSED',
        "closed_by" uuid NOT NULL,
        "closed_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "reopen_reason" character varying(500),
        "reopened_by" uuid,
        "reopened_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_cash_closings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_cash_closings_closing_date" UNIQUE ("closing_date"),
        CONSTRAINT "CHK_cash_closings_amounts" CHECK (
          expected_cash_cents >= 0 AND counted_cash_cents >= 0
        ),
        CONSTRAINT "CHK_cash_closings_reopening" CHECK (
          status = 'CLOSED'::cash_closing_status OR (
            status = 'REOPENED'::cash_closing_status
            AND reopen_reason IS NOT NULL
            AND reopened_by IS NOT NULL
            AND reopened_at IS NOT NULL
          )
        ),
        CONSTRAINT "FK_cash_closings_closed_by" FOREIGN KEY ("closed_by")
          REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
        CONSTRAINT "FK_cash_closings_reopened_by" FOREIGN KEY ("reopened_by")
          REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE FUNCTION guard_closed_cashbox_day() RETURNS trigger AS $$
      DECLARE
        operation_date date;
      BEGIN
        IF NEW.method::text <> 'CASH' THEN
          RETURN NEW;
        END IF;

        IF TG_OP = 'INSERT' AND NEW.status::text = 'APPROVED' THEN
          operation_date := (NEW.reviewed_at AT TIME ZONE 'America/Sao_Paulo')::date;
        ELSIF TG_OP = 'UPDATE'
          AND OLD.status::text IS DISTINCT FROM NEW.status::text
          AND NEW.status::text IN ('APPROVED', 'REVERSED') THEN
          operation_date := (
            CASE WHEN NEW.status::text = 'REVERSED' THEN OLD.reviewed_at ELSE NEW.reviewed_at END
            AT TIME ZONE 'America/Sao_Paulo'
          )::date;
        ELSE
          RETURN NEW;
        END IF;

        IF operation_date IS NOT NULL THEN
          PERFORM pg_advisory_xact_lock(
            hashtext('tenancy-ledger:cashbox:' || operation_date::text)
          );
        END IF;

        IF operation_date IS NOT NULL AND EXISTS (
          SELECT 1 FROM cash_closings closing
          WHERE closing.closing_date = operation_date
            AND closing.status = 'CLOSED'::cash_closing_status
        ) THEN
          RAISE EXCEPTION USING
            ERRCODE = '23514',
            CONSTRAINT = 'CHK_cashbox_day_open',
            MESSAGE = 'cashbox day is closed';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TR_guard_closed_cashbox_day"
      BEFORE INSERT OR UPDATE OF status, method, reviewed_at ON "payment_transactions"
      FOR EACH ROW EXECUTE FUNCTION guard_closed_cashbox_day()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER "TR_guard_closed_cashbox_day" ON "payment_transactions"`);
    await queryRunner.query(`DROP FUNCTION guard_closed_cashbox_day()`);
    await queryRunner.query(`DROP TABLE "cash_closings"`);
    await queryRunner.query(`DROP TYPE "cash_closing_status"`);
  }
}
