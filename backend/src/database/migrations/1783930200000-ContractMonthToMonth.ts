import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContractMonthToMonth1783930200000 implements MigrationInterface {
  name = 'ContractMonthToMonth1783930200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."contract_type" AS ENUM('FIXED_TERM', 'MONTH_TO_MONTH')`,
    );
    await queryRunner.query(
      `ALTER TABLE "contracts" ADD "contract_type" "public"."contract_type" NOT NULL DEFAULT 'FIXED_TERM'`,
    );
    await queryRunner.query(
      `ALTER TABLE "contracts" DROP CONSTRAINT "EX_contracts_no_overlapping_period"`,
    );
    await queryRunner.query(`ALTER TABLE "contracts" DROP CONSTRAINT "CHK_contracts_valid_period"`);
    await queryRunner.query(
      `ALTER TABLE "contracts" DROP CONSTRAINT "CHK_contracts_duration_positive"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contracts" DROP CONSTRAINT "CHK_contracts_duration_range"`,
    );
    await queryRunner.query(`ALTER TABLE "contracts" ALTER COLUMN "end_date" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "contracts" ALTER COLUMN "duration_in_months" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "contracts" ADD CONSTRAINT "CHK_contracts_valid_period" CHECK ("end_date" IS NULL OR "end_date" >= "move_in_date")`,
    );
    await queryRunner.query(
      `ALTER TABLE "contracts" ADD CONSTRAINT "CHK_contracts_duration_positive" CHECK ("duration_in_months" IS NULL OR "duration_in_months" > 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "contracts" ADD CONSTRAINT "CHK_contracts_duration_range" CHECK ("duration_in_months" IS NULL OR "duration_in_months" BETWEEN 1 AND 600)`,
    );
    await queryRunner.query(`
      ALTER TABLE "contracts" ADD CONSTRAINT "CHK_contracts_type_period" CHECK (
        ("contract_type" = 'FIXED_TERM'::"contract_type"
          AND "end_date" IS NOT NULL AND "duration_in_months" IS NOT NULL)
        OR
        ("contract_type" = 'MONTH_TO_MONTH'::"contract_type"
          AND "end_date" IS NULL AND "duration_in_months" IS NULL)
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "contracts" ADD CONSTRAINT "EX_contracts_no_overlapping_period"
      EXCLUDE USING gist (
        "property_unit_id" WITH =,
        daterange("move_in_date", COALESCE("end_date", 'infinity'::date), '[]') WITH &&
      ) WHERE ("status" <> 'TERMINATED'::"contract_status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contracts" DROP CONSTRAINT "EX_contracts_no_overlapping_period"`,
    );
    await queryRunner.query(`ALTER TABLE "contracts" DROP CONSTRAINT "CHK_contracts_type_period"`);
    await queryRunner.query(`ALTER TABLE "contracts" DROP CONSTRAINT "CHK_contracts_valid_period"`);
    await queryRunner.query(
      `ALTER TABLE "contracts" DROP CONSTRAINT "CHK_contracts_duration_positive"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contracts" DROP CONSTRAINT "CHK_contracts_duration_range"`,
    );
    await queryRunner.query(`
      UPDATE "contracts"
      SET "contract_type" = 'FIXED_TERM'::"contract_type",
          "duration_in_months" = 1,
          "end_date" = (("move_in_date" + INTERVAL '1 month')::date - 1)
      WHERE "contract_type" = 'MONTH_TO_MONTH'::"contract_type"
    `);
    await queryRunner.query(`ALTER TABLE "contracts" ALTER COLUMN "end_date" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "contracts" ALTER COLUMN "duration_in_months" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "contracts" ADD CONSTRAINT "CHK_contracts_valid_period" CHECK ("end_date" >= "move_in_date")`,
    );
    await queryRunner.query(
      `ALTER TABLE "contracts" ADD CONSTRAINT "CHK_contracts_duration_positive" CHECK ("duration_in_months" > 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "contracts" ADD CONSTRAINT "CHK_contracts_duration_range" CHECK ("duration_in_months" BETWEEN 1 AND 600)`,
    );
    await queryRunner.query(`
      ALTER TABLE "contracts" ADD CONSTRAINT "EX_contracts_no_overlapping_period"
      EXCLUDE USING gist (
        "property_unit_id" WITH =,
        daterange("move_in_date", "end_date", '[]') WITH &&
      ) WHERE ("status" <> 'TERMINATED'::"contract_status")
    `);
    await queryRunner.query(`ALTER TABLE "contracts" DROP COLUMN "contract_type"`);
    await queryRunner.query(`DROP TYPE "public"."contract_type"`);
  }
}
