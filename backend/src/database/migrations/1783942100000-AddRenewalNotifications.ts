import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRenewalNotifications1783942100000 implements MigrationInterface {
  name = 'AddRenewalNotifications1783942100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "CHK_notifications_type"`);
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "deduplication_key" character varying(160)`,
    );
    await queryRunner.query(`
      ALTER TABLE "notifications" ADD CONSTRAINT "CHK_notifications_type" CHECK (
        type IN (
          'PAYMENT_SUBMITTED', 'PAYMENT_APPROVED', 'PAYMENT_REJECTED',
          'RENEWAL_DUE', 'PAYMENT_OVERDUE'
        )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_notifications_user_deduplication"
      ON "notifications" ("user_id", "deduplication_key")
      WHERE "deduplication_key" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_notifications_user_deduplication"`);
    await queryRunner.query(
      `DELETE FROM "notifications" WHERE "type" IN ('RENEWAL_DUE', 'PAYMENT_OVERDUE')`,
    );
    await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "CHK_notifications_type"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "deduplication_key"`);
    await queryRunner.query(`
      ALTER TABLE "notifications" ADD CONSTRAINT "CHK_notifications_type" CHECK (
        type IN ('PAYMENT_SUBMITTED', 'PAYMENT_APPROVED', 'PAYMENT_REJECTED')
      )
    `);
  }
}
