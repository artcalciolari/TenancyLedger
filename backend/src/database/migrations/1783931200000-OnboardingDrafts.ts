import { MigrationInterface, QueryRunner } from 'typeorm';

export class OnboardingDrafts1783931200000 implements MigrationInterface {
  name = 'OnboardingDrafts1783931200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."onboarding_draft_status" AS ENUM('DRAFT', 'COMPLETED', 'DISCARDED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "onboarding_drafts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "payload" jsonb NOT NULL,
        "created_by" uuid NOT NULL,
        "status" "public"."onboarding_draft_status" NOT NULL DEFAULT 'DRAFT',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_onboarding_drafts_payload_size" CHECK (octet_length(payload::text) <= 65536),
        CONSTRAINT "PK_onboarding_drafts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_onboarding_drafts_creator_updated"
      ON "onboarding_drafts" ("created_by", "updated_at", "id")
    `);
    await queryRunner.query(`
      ALTER TABLE "onboarding_drafts"
      ADD CONSTRAINT "FK_onboarding_drafts_created_by"
      FOREIGN KEY ("created_by") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE RESTRICT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "onboarding_drafts" DROP CONSTRAINT "FK_onboarding_drafts_created_by"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_onboarding_drafts_creator_updated"`);
    await queryRunner.query(`DROP TABLE "onboarding_drafts"`);
    await queryRunner.query(`DROP TYPE "public"."onboarding_draft_status"`);
  }
}
