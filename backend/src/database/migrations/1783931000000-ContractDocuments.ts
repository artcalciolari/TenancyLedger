import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContractDocuments1783931000000 implements MigrationInterface {
  name = 'ContractDocuments1783931000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."contract_document_kind" AS ENUM('GENERATED', 'SIGNED', 'OTHER')`,
    );
    await queryRunner.query(`
      CREATE TABLE "contract_documents" (
        "id" uuid NOT NULL,
        "contract_id" uuid NOT NULL,
        "kind" "public"."contract_document_kind" NOT NULL,
        "version" integer NOT NULL,
        "storage_key" character varying(500) NOT NULL,
        "original_name" character varying(255) NOT NULL,
        "content_type" character varying(100) NOT NULL,
        "uploaded_by" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_contract_documents" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_contract_documents_kind_version" UNIQUE ("contract_id", "kind", "version"),
        CONSTRAINT "CHK_contract_documents_version" CHECK (version > 0),
        CONSTRAINT "CHK_contract_documents_original_name" CHECK (char_length(trim(original_name)) BETWEEN 1 AND 255),
        CONSTRAINT "CHK_contract_documents_storage_key" CHECK (storage_key ~ '^documents/contract-documents/[0-9a-f-]{36}/[0-9a-f-]{36}[.](pdf|jpg|png|webp|heic|heif)$')
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_contract_documents_contract_created"
      ON "contract_documents" ("contract_id", "created_at", "id")
    `);
    await queryRunner.query(`
      ALTER TABLE "contract_documents"
      ADD CONSTRAINT "FK_contract_documents_contract"
      FOREIGN KEY ("contract_id") REFERENCES "contracts"("id")
      ON DELETE RESTRICT ON UPDATE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "contract_documents"
      ADD CONSTRAINT "FK_contract_documents_uploaded_by"
      FOREIGN KEY ("uploaded_by") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE RESTRICT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contract_documents" DROP CONSTRAINT "FK_contract_documents_uploaded_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contract_documents" DROP CONSTRAINT "FK_contract_documents_contract"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_contract_documents_contract_created"`);
    await queryRunner.query(`DROP TABLE "contract_documents"`);
    await queryRunner.query(`DROP TYPE "public"."contract_document_kind"`);
  }
}
