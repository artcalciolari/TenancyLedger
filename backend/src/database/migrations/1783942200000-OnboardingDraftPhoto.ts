import { MigrationInterface, QueryRunner } from 'typeorm';

export class OnboardingDraftPhoto1783942200000 implements MigrationInterface {
  name = 'OnboardingDraftPhoto1783942200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "onboarding_drafts" ADD "photo_storage_key" character varying(500)`,
    );
    await queryRunner.query(`
      ALTER TABLE "onboarding_drafts"
      ADD CONSTRAINT "CHK_onboarding_drafts_photo_storage_key"
      CHECK (
        photo_storage_key IS NULL OR
        photo_storage_key ~ '^documents/onboarding-draft-photos/[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|heic|heif)$'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "onboarding_drafts" DROP CONSTRAINT "CHK_onboarding_drafts_photo_storage_key"`,
    );
    await queryRunner.query(`ALTER TABLE "onboarding_drafts" DROP COLUMN "photo_storage_key"`);
  }
}
