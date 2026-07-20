import { MigrationInterface, QueryRunner } from 'typeorm';

export class Receipts1783930800000 implements MigrationInterface {
  name = 'Receipts1783930800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE SEQUENCE "receipt_number_seq" AS bigint START WITH 1 INCREMENT BY 1`,
    );
    await queryRunner.query(`
      CREATE TABLE "receipts" (
        "id" uuid NOT NULL,
        "number" bigint NOT NULL DEFAULT nextval('receipt_number_seq'),
        "payment_transaction_id" uuid NOT NULL,
        "invoice_id" uuid NOT NULL,
        "contract_id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "tenant_name" character varying(120) NOT NULL,
        "tenant_cpf" character(11) NOT NULL,
        "property_unit_id" uuid NOT NULL,
        "property_description" character varying(300) NOT NULL,
        "period_start" date NOT NULL,
        "period_end" date NOT NULL,
        "amount_cents" integer NOT NULL,
        "payment_method" character varying(30) NOT NULL,
        "issued_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "storage_key" character varying(500) NOT NULL,
        "voided_reason" character varying(500),
        "voided_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_receipts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_receipts_number" UNIQUE ("number"),
        CONSTRAINT "UQ_receipts_payment_transaction" UNIQUE ("payment_transaction_id"),
        CONSTRAINT "CHK_receipts_number_positive" CHECK (number > 0),
        CONSTRAINT "CHK_receipts_amount_positive" CHECK (amount_cents > 0),
        CONSTRAINT "CHK_receipts_period" CHECK (period_end >= period_start),
        CONSTRAINT "CHK_receipts_tenant_cpf" CHECK (tenant_cpf ~ '^[0-9]{11}$'),
        CONSTRAINT "CHK_receipts_storage_key" CHECK (storage_key ~ '^documents/receipts/[0-9a-f-]{36}/[0-9a-f-]{36}[.]pdf$'),
        CONSTRAINT "CHK_receipts_void_state" CHECK ((voided_at IS NULL AND voided_reason IS NULL) OR (voided_at IS NOT NULL AND char_length(trim(voided_reason)) BETWEEN 1 AND 500))
      )
    `);
    await queryRunner.query(`ALTER SEQUENCE "receipt_number_seq" OWNED BY "receipts"."number"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_receipts_issued_at" ON "receipts" ("issued_at", "id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "receipts"
      ADD CONSTRAINT "FK_receipts_payment_transaction"
      FOREIGN KEY ("payment_transaction_id") REFERENCES "payment_transactions"("id")
      ON DELETE RESTRICT ON UPDATE RESTRICT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT "FK_receipts_payment_transaction"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_receipts_issued_at"`);
    await queryRunner.query(`DROP TABLE "receipts"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "receipt_number_seq"`);
  }
}
