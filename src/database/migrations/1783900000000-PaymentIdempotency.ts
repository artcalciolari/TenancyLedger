import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentIdempotency1783900000000 implements MigrationInterface {
  name = 'PaymentIdempotency1783900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD "idempotency_key" character varying(128)`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD "request_fingerprint" character(64)`,
    );
    await queryRunner.query(
      `UPDATE "payment_transactions" SET "idempotency_key" = 'legacy-' || "id"::text, "request_fingerprint" = md5("id"::text) || md5('legacy-' || "id"::text)`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ALTER COLUMN "idempotency_key" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ALTER COLUMN "request_fingerprint" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD CONSTRAINT "CHK_payment_transactions_idempotency_key" CHECK (char_length("idempotency_key") BETWEEN 8 AND 128)`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD CONSTRAINT "CHK_payment_transactions_request_fingerprint" CHECK ("request_fingerprint" ~ '^[0-9a-f]{64}$')`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD CONSTRAINT "UQ_payment_transactions_invoice_id_idempotency_key" UNIQUE ("invoice_id", "idempotency_key")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "UQ_payment_transactions_invoice_id_idempotency_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "CHK_payment_transactions_request_fingerprint"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "CHK_payment_transactions_idempotency_key"`,
    );
    await queryRunner.query(`ALTER TABLE "payment_transactions" DROP COLUMN "request_fingerprint"`);
    await queryRunner.query(`ALTER TABLE "payment_transactions" DROP COLUMN "idempotency_key"`);
  }
}
