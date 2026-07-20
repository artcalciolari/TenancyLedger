import { MigrationInterface, QueryRunner } from 'typeorm';

export class InvoiceCoveragePeriod1783930400000 implements MigrationInterface {
  name = 'InvoiceCoveragePeriod1783930400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invoices" ADD "period_start" date`);
    await queryRunner.query(`ALTER TABLE "invoices" ADD "period_end" date`);
    await queryRunner.query(`ALTER TABLE "invoices" DISABLE TRIGGER "TR_invoices_ledger_status"`);
    await queryRunner.query(`
      UPDATE "invoices"
      SET "period_start" = to_date("competence", 'YYYY-MM'),
          "period_end" = (to_date("competence", 'YYYY-MM') + INTERVAL '1 month - 1 day')::date
      WHERE "period_start" IS NULL OR "period_end" IS NULL
    `);
    await queryRunner.query(`ALTER TABLE "invoices" ALTER COLUMN "period_start" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "invoices" ALTER COLUMN "period_end" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "invoices" ENABLE TRIGGER "TR_invoices_ledger_status"`);
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "UQ_invoices_contract_competence"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "UQ_invoices_contract_period_start" UNIQUE ("contract_id", "period_start")`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "CHK_invoices_period" CHECK ("period_end" >= "period_start")`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "CHK_invoices_period_competence" CHECK ("competence" = to_char("period_start", 'YYYY-MM'))`,
    );
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_invoice_immutable_fields() RETURNS trigger AS $$
      BEGIN
        IF OLD.contract_id <> NEW.contract_id
          OR OLD.competence <> NEW.competence
          OR OLD.total_value_cents <> NEW.total_value_cents
          OR OLD.due_date <> NEW.due_date
          OR OLD.period_start <> NEW.period_start
          OR OLD.period_end <> NEW.period_end THEN
          RAISE EXCEPTION 'immutable invoice fields cannot be changed';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_invoice_immutable_fields() RETURNS trigger AS $$
      BEGIN
        IF OLD.contract_id <> NEW.contract_id
          OR OLD.competence <> NEW.competence
          OR OLD.total_value_cents <> NEW.total_value_cents
          OR OLD.due_date <> NEW.due_date THEN
          RAISE EXCEPTION 'immutable invoice fields cannot be changed';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "CHK_invoices_period_competence"`,
    );
    await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "CHK_invoices_period"`);
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "UQ_invoices_contract_period_start"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "UQ_invoices_contract_competence" UNIQUE ("contract_id", "competence")`,
    );
    await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "period_end"`);
    await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "period_start"`);
  }
}
