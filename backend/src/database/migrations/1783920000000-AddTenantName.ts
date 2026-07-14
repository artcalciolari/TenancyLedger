import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantName1783920000000 implements MigrationInterface {
  name = 'AddTenantName1783920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" ADD "full_name" character varying(120)`);
    await queryRunner.query(
      `UPDATE "tenants" SET "full_name" = 'Nome não informado' WHERE "full_name" IS NULL`,
    );
    await queryRunner.query(`ALTER TABLE "tenants" ALTER COLUMN "full_name" SET NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD CONSTRAINT "CHK_tenants_full_name_not_blank"
      CHECK (char_length(trim(full_name)) BETWEEN 3 AND 120)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" DROP CONSTRAINT "CHK_tenants_full_name_not_blank"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "full_name"`);
  }
}
