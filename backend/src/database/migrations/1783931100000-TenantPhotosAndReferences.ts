import { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantPhotosAndReferences1783931100000 implements MigrationInterface {
  name = 'TenantPhotosAndReferences1783931100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" ADD "photo_storage_key" character varying(500)`);
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD CONSTRAINT "CHK_tenants_photo_storage_key"
      CHECK (
        photo_storage_key IS NULL OR
        photo_storage_key ~ '^documents/tenant-photos/[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|heic|heif)$'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "tenant_references" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" character varying(120) NOT NULL,
        "relationship" character varying(80) NOT NULL,
        "phone" character varying(13) NOT NULL,
        "email" character varying(254),
        "verified_at" TIMESTAMP WITH TIME ZONE,
        "verified_by" uuid,
        "notes" character varying(1000),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_tenant_references_name" CHECK (char_length(trim(name)) BETWEEN 2 AND 120),
        CONSTRAINT "CHK_tenant_references_relationship" CHECK (char_length(trim(relationship)) BETWEEN 2 AND 80),
        CONSTRAINT "CHK_tenant_references_phone" CHECK (phone ~ '^[1-9]{2}[2-9][0-9]{7,8}$'),
        CONSTRAINT "CHK_tenant_references_email" CHECK (email IS NULL OR (email = lower(trim(email)) AND char_length(email) <= 254)),
        CONSTRAINT "CHK_tenant_references_verification" CHECK ((verified_at IS NULL AND verified_by IS NULL) OR (verified_at IS NOT NULL AND verified_by IS NOT NULL)),
        CONSTRAINT "PK_tenant_references" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_tenant_references_tenant_created"
      ON "tenant_references" ("tenant_id", "created_at", "id")
    `);
    await queryRunner.query(`
      ALTER TABLE "tenant_references"
      ADD CONSTRAINT "FK_tenant_references_tenant"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "tenant_references"
      ADD CONSTRAINT "FK_tenant_references_verified_by"
      FOREIGN KEY ("verified_by") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE RESTRICT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenant_references" DROP CONSTRAINT "FK_tenant_references_verified_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_references" DROP CONSTRAINT "FK_tenant_references_tenant"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_tenant_references_tenant_created"`);
    await queryRunner.query(`DROP TABLE "tenant_references"`);
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP CONSTRAINT "CHK_tenants_photo_storage_key"`,
    );
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "photo_storage_key"`);
  }
}
