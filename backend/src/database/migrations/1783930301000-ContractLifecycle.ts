import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContractLifecycle1783930301000 implements MigrationInterface {
  name = 'ContractLifecycle1783930301000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "contracts" ADD "status_reason" character varying(500)`);
    await queryRunner.query(
      `ALTER TABLE "contracts" ADD "status_changed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "contracts" DROP CONSTRAINT "EX_contracts_no_overlapping_period"`,
    );
    await queryRunner.query(`
      ALTER TABLE "contracts" ADD CONSTRAINT "EX_contracts_no_overlapping_period"
      EXCLUDE USING gist (
        "property_unit_id" WITH =,
        daterange("move_in_date", COALESCE("end_date", 'infinity'::date), '[]') WITH &&
      ) WHERE ("status" NOT IN ('TERMINATED'::"contract_status", 'CANCELLED'::"contract_status"))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contracts" DROP CONSTRAINT "EX_contracts_no_overlapping_period"`,
    );
    await queryRunner.query(`
      UPDATE "contracts"
      SET "status" = CASE
        WHEN "status"::text = 'CANCELLED' THEN 'TERMINATED'::"contract_status"
        ELSE 'ACTIVE'::"contract_status"
      END
      WHERE "status"::text IN ('PENDING_SIGNATURE', 'PAYMENT_PENDING', 'ENDING', 'CANCELLED')
    `);
    await queryRunner.query(`
      ALTER TABLE "contracts" ADD CONSTRAINT "EX_contracts_no_overlapping_period"
      EXCLUDE USING gist (
        "property_unit_id" WITH =,
        daterange("move_in_date", COALESCE("end_date", 'infinity'::date), '[]') WITH &&
      ) WHERE ("status" <> 'TERMINATED'::"contract_status")
    `);
    await queryRunner.query(`ALTER TABLE "contracts" DROP COLUMN "status_changed_at"`);
    await queryRunner.query(`ALTER TABLE "contracts" DROP COLUMN "status_reason"`);
  }
}
