import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1783898801690 implements MigrationInterface {
  name = 'InitialSchema1783898801690';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor_id" uuid, "action" character varying(120) NOT NULL, "resource_type" character varying(80) NOT NULL, "resource_id" uuid, "request_id" character varying(100), "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_resource" ON "audit_logs" ("resource_type", "resource_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_actor_occurred_at" ON "audit_logs" ("actor_id", "occurred_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."property_unit_type" AS ENUM('KITNET', 'ROOM', 'APARTMENT', 'HOUSE', 'COMMERCIAL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "property_units" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "neighborhood" character varying(120) NOT NULL, "type" "public"."property_unit_type" NOT NULL, "unit_number" character varying(40) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_property_units_neighborhood_unit" UNIQUE ("neighborhood", "unit_number"), CONSTRAINT "CHK_property_units_unit_number_not_blank" CHECK (char_length(trim(unit_number)) > 0), CONSTRAINT "CHK_property_units_neighborhood_not_blank" CHECK (char_length(trim(neighborhood)) > 0), CONSTRAINT "PK_c7d7d8f633643123e9f9e0a0c83" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_method" AS ENUM('PIX', 'CASH', 'BANK_TRANSFER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_proof_type" AS ENUM('DIGITAL_SLIP', 'SIGNED_RECEIPT', 'BANK_STATEMENT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_status" AS ENUM('SUBMITTED', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payment_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "amount_cents" integer NOT NULL, "submitted_at" TIMESTAMP WITH TIME ZONE NOT NULL, "proof_reference" character varying(500), "method" "public"."payment_method" NOT NULL, "proof_type" "public"."payment_proof_type", "status" "public"."payment_status" NOT NULL DEFAULT 'SUBMITTED', "reviewed_at" TIMESTAMP WITH TIME ZONE, "rejection_reason" character varying(500), "invoice_id" uuid NOT NULL, CONSTRAINT "CHK_payment_transactions_amount_positive" CHECK (amount_cents > 0), CONSTRAINT "PK_d32b3c6b0d2c1d22604cbcc8c49" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_transactions_invoice_id" ON "payment_transactions" ("invoice_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."invoice_status" AS ENUM('OPEN', 'UNDER_REVIEW', 'PARTIALLY_PAID', 'PAID', 'OVERDUE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "invoices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "contract_id" uuid NOT NULL, "competence" character(7) NOT NULL, "total_value_cents" integer NOT NULL, "due_date" date NOT NULL, "status" "public"."invoice_status" NOT NULL DEFAULT 'OPEN', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_invoices_contract_competence" UNIQUE ("contract_id", "competence"), CONSTRAINT "CHK_invoices_competence_format" CHECK (competence ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'), CONSTRAINT "CHK_invoices_total_positive" CHECK (total_value_cents > 0), CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."contract_status" AS ENUM('ACTIVE', 'EXPIRED', 'TERMINATED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "contracts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "property_unit_id" uuid NOT NULL, "move_in_date" date NOT NULL, "end_date" date NOT NULL, "monthly_base_value_cents" integer NOT NULL, "duration_in_months" integer NOT NULL, "billing_day" smallint NOT NULL, "is_renewable" boolean NOT NULL, "status" "public"."contract_status" NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_contracts_valid_period" CHECK (end_date >= move_in_date), CONSTRAINT "CHK_contracts_billing_day" CHECK (billing_day BETWEEN 1 AND 28), CONSTRAINT "CHK_contracts_duration_positive" CHECK (duration_in_months > 0), CONSTRAINT "CHK_contracts_monthly_value_positive" CHECK (monthly_base_value_cents > 0), CONSTRAINT "PK_2c7b8f3a7b1acdd49497d83d0fb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'MANAGER', 'VIEWER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(254) NOT NULL, "password_hash" character varying NOT NULL, "role" "public"."user_role" NOT NULL DEFAULT 'VIEWER', "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tenant_civil_status" AS ENUM('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'STABLE_UNION')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tenants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "cpf" character varying(11) NOT NULL, "rg" character varying(20) NOT NULL, "profession" character varying(100) NOT NULL, "civil_status" "public"."tenant_civil_status" NOT NULL, "email" character varying(254) NOT NULL, "mobile_phone" character varying(13) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_7bcd4242291d61c89d40e2100f9" UNIQUE ("cpf"), CONSTRAINT "UQ_155c343439adc83ada6ee3f48be" UNIQUE ("email"), CONSTRAINT "UQ_8038636a2548cf29bbb51d4322d" UNIQUE ("mobile_phone"), CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD CONSTRAINT "FK_d43f7ac66aab4c15fc030c46fa3" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_d43f7ac66aab4c15fc030c46fa3"`,
    );
    await queryRunner.query(`DROP TABLE "tenants"`);
    await queryRunner.query(`DROP TYPE "public"."tenant_civil_status"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."user_role"`);
    await queryRunner.query(`DROP TABLE "contracts"`);
    await queryRunner.query(`DROP TYPE "public"."contract_status"`);
    await queryRunner.query(`DROP TABLE "invoices"`);
    await queryRunner.query(`DROP TYPE "public"."invoice_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_payment_transactions_invoice_id"`);
    await queryRunner.query(`DROP TABLE "payment_transactions"`);
    await queryRunner.query(`DROP TYPE "public"."payment_status"`);
    await queryRunner.query(`DROP TYPE "public"."payment_proof_type"`);
    await queryRunner.query(`DROP TYPE "public"."payment_method"`);
    await queryRunner.query(`DROP TABLE "property_units"`);
    await queryRunner.query(`DROP TYPE "public"."property_unit_type"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_actor_occurred_at"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_resource"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
  }
}
