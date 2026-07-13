import { MigrationInterface, QueryRunner } from 'typeorm';

export class IntegrityConstraints1783898802000 implements MigrationInterface {
  name = 'IntegrityConstraints1783898802000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "btree_gist"`);

    await queryRunner.query(`CREATE INDEX "IDX_contracts_tenant_id" ON "contracts" ("tenant_id")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_contracts_property_unit_id" ON "contracts" ("property_unit_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invoices_contract_id" ON "invoices" ("contract_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_property_units_location_ci" ON "property_units" (lower("neighborhood"), lower("unit_number"))`,
    );

    await queryRunner.query(
      `ALTER TABLE "contracts" ADD CONSTRAINT "FK_contracts_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "contracts" ADD CONSTRAINT "FK_contracts_property_unit" FOREIGN KEY ("property_unit_id") REFERENCES "property_units"("id") ON DELETE RESTRICT ON UPDATE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_contract" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_audit_logs_actor" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE RESTRICT`,
    );

    await queryRunner.query(
      `ALTER TABLE "contracts" ADD CONSTRAINT "CHK_contracts_duration_range" CHECK ("duration_in_months" BETWEEN 1 AND 600)`,
    );
    await queryRunner.query(
      `ALTER TABLE "contracts" ADD CONSTRAINT "EX_contracts_no_overlapping_period" EXCLUDE USING gist ("property_unit_id" WITH =, daterange("move_in_date", "end_date", '[]') WITH &&) WHERE ("status" <> 'TERMINATED'::"contract_status")`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "CHK_invoices_due_date_competence" CHECK (EXTRACT(YEAR FROM "due_date") = substring("competence" from 1 for 4)::integer AND EXTRACT(MONTH FROM "due_date") = substring("competence" from 6 for 2)::integer)`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD CONSTRAINT "CHK_payment_transactions_proof" CHECK ("method" = 'CASH'::"payment_method" OR ("proof_type" IS NOT NULL AND "proof_reference" IS NOT NULL AND char_length(trim("proof_reference")) > 0))`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD CONSTRAINT "CHK_payment_transactions_review_state" CHECK (("status" = 'SUBMITTED'::"payment_status" AND "reviewed_at" IS NULL AND "rejection_reason" IS NULL) OR ("status" = 'APPROVED'::"payment_status" AND "reviewed_at" IS NOT NULL AND "rejection_reason" IS NULL) OR ("status" = 'REJECTED'::"payment_status" AND "reviewed_at" IS NOT NULL AND "rejection_reason" IS NOT NULL AND char_length(trim("rejection_reason")) > 0))`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD CONSTRAINT "CHK_tenants_cpf_digits" CHECK ("cpf" ~ '^[0-9]{11}$')`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD CONSTRAINT "CHK_tenants_mobile_digits" CHECK ("mobile_phone" ~ '^[1-9]{2}9[0-9]{8}$')`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD CONSTRAINT "CHK_tenants_email_normalized" CHECK ("email" = lower(trim("email")))`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD CONSTRAINT "CHK_tenants_rg_not_blank" CHECK (char_length(trim("rg")) BETWEEN 5 AND 20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD CONSTRAINT "CHK_tenants_profession_not_blank" CHECK (char_length(trim("profession")) BETWEEN 2 AND 100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_users_email_normalized" CHECK ("email" = lower(trim("email")))`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_users_password_hash" CHECK (char_length("password_hash") >= 50)`,
    );

    await queryRunner.query(`
      CREATE FUNCTION prevent_audit_log_mutation() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'audit logs are append-only';
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TR_audit_logs_append_only"
      BEFORE UPDATE OR DELETE ON "audit_logs"
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation()
    `);

    await queryRunner.query(`
      CREATE FUNCTION prevent_ledger_delete() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'financial ledger records cannot be deleted';
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TR_invoices_no_delete"
      BEFORE DELETE ON "invoices"
      FOR EACH ROW EXECUTE FUNCTION prevent_ledger_delete()
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TR_payment_transactions_no_delete"
      BEFORE DELETE ON "payment_transactions"
      FOR EACH ROW EXECUTE FUNCTION prevent_ledger_delete()
    `);

    await queryRunner.query(`
      CREATE FUNCTION enforce_invoice_immutable_fields() RETURNS trigger AS $$
      BEGIN
        IF OLD.contract_id <> NEW.contract_id
          OR OLD.competence <> NEW.competence
          OR OLD.total_value_cents <> NEW.total_value_cents
          OR OLD.due_date <> NEW.due_date THEN
          RAISE EXCEPTION 'immutable invoice fields cannot be changed';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TR_invoices_immutable_fields"
      BEFORE UPDATE ON "invoices"
      FOR EACH ROW EXECUTE FUNCTION enforce_invoice_immutable_fields()
    `);

    await queryRunner.query(`
      CREATE FUNCTION enforce_payment_immutable_fields() RETURNS trigger AS $$
      BEGIN
        IF OLD.invoice_id <> NEW.invoice_id
          OR OLD.amount_cents <> NEW.amount_cents
          OR OLD.submitted_at <> NEW.submitted_at
          OR OLD.method <> NEW.method
          OR OLD.proof_type IS DISTINCT FROM NEW.proof_type
          OR OLD.proof_reference IS DISTINCT FROM NEW.proof_reference THEN
          RAISE EXCEPTION 'immutable payment fields cannot be changed';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TR_payment_transactions_immutable_fields"
      BEFORE UPDATE ON "payment_transactions"
      FOR EACH ROW EXECUTE FUNCTION enforce_payment_immutable_fields()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER "TR_payment_transactions_immutable_fields" ON "payment_transactions"`,
    );
    await queryRunner.query(`DROP FUNCTION enforce_payment_immutable_fields()`);
    await queryRunner.query(`DROP TRIGGER "TR_invoices_immutable_fields" ON "invoices"`);
    await queryRunner.query(`DROP FUNCTION enforce_invoice_immutable_fields()`);
    await queryRunner.query(
      `DROP TRIGGER "TR_payment_transactions_no_delete" ON "payment_transactions"`,
    );
    await queryRunner.query(`DROP TRIGGER "TR_invoices_no_delete" ON "invoices"`);
    await queryRunner.query(`DROP FUNCTION prevent_ledger_delete()`);
    await queryRunner.query(`DROP TRIGGER "TR_audit_logs_append_only" ON "audit_logs"`);
    await queryRunner.query(`DROP FUNCTION prevent_audit_log_mutation()`);

    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_users_password_hash"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_users_email_normalized"`);
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP CONSTRAINT "CHK_tenants_profession_not_blank"`,
    );
    await queryRunner.query(`ALTER TABLE "tenants" DROP CONSTRAINT "CHK_tenants_rg_not_blank"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP CONSTRAINT "CHK_tenants_email_normalized"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP CONSTRAINT "CHK_tenants_mobile_digits"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP CONSTRAINT "CHK_tenants_cpf_digits"`);
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "CHK_payment_transactions_review_state"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "CHK_payment_transactions_proof"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "CHK_invoices_due_date_competence"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contracts" DROP CONSTRAINT "EX_contracts_no_overlapping_period"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contracts" DROP CONSTRAINT "CHK_contracts_duration_range"`,
    );

    await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_audit_logs_actor"`);
    await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_contract"`);
    await queryRunner.query(`ALTER TABLE "contracts" DROP CONSTRAINT "FK_contracts_property_unit"`);
    await queryRunner.query(`ALTER TABLE "contracts" DROP CONSTRAINT "FK_contracts_tenant"`);

    await queryRunner.query(`DROP INDEX "public"."UQ_property_units_location_ci"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_invoices_contract_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_contracts_property_unit_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_contracts_tenant_id"`);
  }
}
