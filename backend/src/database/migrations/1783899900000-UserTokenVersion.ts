import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserTokenVersion1783899900000 implements MigrationInterface {
  name = 'UserTokenVersion1783899900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "token_version" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_users_token_version" CHECK ("token_version" >= 0)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_users_token_version"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "token_version"`);
  }
}
