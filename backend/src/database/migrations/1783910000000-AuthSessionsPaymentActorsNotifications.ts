import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthSessionsPaymentActorsNotifications1783910000000 implements MigrationInterface {
  name = 'AuthSessionsPaymentActorsNotifications1783910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "refresh_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "family_id" uuid NOT NULL,
        "token_version" integer NOT NULL,
        "token_hash" character(64) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "replaced_by_session_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_refresh_sessions_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "CHK_refresh_sessions_token_hash" CHECK (token_hash ~ '^[0-9a-f]{64}$'),
        CONSTRAINT "CHK_refresh_sessions_expiration" CHECK (expires_at > created_at),
        CONSTRAINT "CHK_refresh_sessions_token_version" CHECK (token_version >= 0),
        CONSTRAINT "FK_refresh_sessions_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE RESTRICT,
        CONSTRAINT "FK_refresh_sessions_replacement" FOREIGN KEY ("replaced_by_session_id")
          REFERENCES "refresh_sessions"("id") ON DELETE SET NULL ON UPDATE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_sessions_user_id" ON "refresh_sessions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_sessions_family_id" ON "refresh_sessions" ("family_id")`,
    );

    await queryRunner.query(`ALTER TABLE "payment_transactions" ADD "submitted_by_user_id" uuid`);
    await queryRunner.query(`ALTER TABLE "payment_transactions" ADD "reviewed_by_user_id" uuid`);
    await queryRunner.query(`
      ALTER TABLE "payment_transactions"
      ADD CONSTRAINT "FK_payment_transactions_submitted_by_user"
      FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_transactions"
      ADD CONSTRAINT "FK_payment_transactions_reviewed_by_user"
      FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_transactions"
      ADD CONSTRAINT "CHK_payment_transactions_distinct_actors"
      CHECK (
        reviewed_by_user_id IS NULL
        OR submitted_by_user_id IS NULL
        OR reviewed_by_user_id <> submitted_by_user_id
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_transactions_submitted_by_user_id" ON "payment_transactions" ("submitted_by_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_transactions_reviewed_by_user_id" ON "payment_transactions" ("reviewed_by_user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" character varying(40) NOT NULL,
        "title" character varying(120) NOT NULL,
        "message" character varying(500) NOT NULL,
        "resource_type" character varying(40) NOT NULL,
        "resource_id" uuid NOT NULL,
        "read_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_notifications_type" CHECK (
          type IN ('PAYMENT_SUBMITTED', 'PAYMENT_APPROVED', 'PAYMENT_REJECTED')
        ),
        CONSTRAINT "CHK_notifications_content" CHECK (
          char_length(trim(title)) > 0 AND char_length(trim(message)) > 0
        ),
        CONSTRAINT "FK_notifications_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_created" ON "notifications" ("user_id", "created_at" DESC, "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_unread" ON "notifications" ("user_id", "created_at" DESC) WHERE "read_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE FUNCTION create_payment_notifications() RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'INSERT' AND NEW.submitted_by_user_id IS NOT NULL THEN
          INSERT INTO notifications (
            user_id, type, title, message, resource_type, resource_id
          )
          SELECT
            users.id,
            'PAYMENT_SUBMITTED',
            'Pagamento aguardando revisão',
            'Um pagamento foi submetido e precisa ser revisado.',
            'INVOICE',
            NEW.invoice_id
          FROM users
          WHERE users.active = true
            AND users.role IN ('ADMIN'::user_role, 'MANAGER'::user_role)
            AND users.id <> NEW.submitted_by_user_id;
        ELSIF TG_OP = 'UPDATE'
          AND OLD.status = 'SUBMITTED'::payment_status
          AND NEW.status IN ('APPROVED'::payment_status, 'REJECTED'::payment_status)
          AND NEW.submitted_by_user_id IS NOT NULL THEN
          INSERT INTO notifications (
            user_id, type, title, message, resource_type, resource_id
          ) VALUES (
            NEW.submitted_by_user_id,
            CASE
              WHEN NEW.status = 'APPROVED'::payment_status THEN 'PAYMENT_APPROVED'
              ELSE 'PAYMENT_REJECTED'
            END,
            CASE
              WHEN NEW.status = 'APPROVED'::payment_status THEN 'Pagamento aprovado'
              ELSE 'Pagamento rejeitado'
            END,
            CASE
              WHEN NEW.status = 'APPROVED'::payment_status
                THEN 'O pagamento submetido por você foi aprovado.'
              ELSE 'O pagamento submetido por você foi rejeitado.'
            END,
            'INVOICE',
            NEW.invoice_id
          );
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TR_payment_notifications"
      AFTER INSERT OR UPDATE OF status ON "payment_transactions"
      FOR EACH ROW EXECUTE FUNCTION create_payment_notifications()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER "TR_payment_notifications" ON "payment_transactions"`);
    await queryRunner.query(`DROP FUNCTION create_payment_notifications()`);
    await queryRunner.query(`DROP INDEX "public"."IDX_notifications_user_unread"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_notifications_user_created"`);
    await queryRunner.query(`DROP TABLE "notifications"`);

    await queryRunner.query(`DROP INDEX "public"."IDX_payment_transactions_reviewed_by_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_payment_transactions_submitted_by_user_id"`);
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "CHK_payment_transactions_distinct_actors"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_payment_transactions_reviewed_by_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_payment_transactions_submitted_by_user"`,
    );
    await queryRunner.query(`ALTER TABLE "payment_transactions" DROP COLUMN "reviewed_by_user_id"`);
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP COLUMN "submitted_by_user_id"`,
    );

    await queryRunner.query(`DROP INDEX "public"."IDX_refresh_sessions_family_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_refresh_sessions_user_id"`);
    await queryRunner.query(`DROP TABLE "refresh_sessions"`);
  }
}
