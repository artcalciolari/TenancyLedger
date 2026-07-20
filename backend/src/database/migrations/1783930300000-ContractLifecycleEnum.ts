import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContractLifecycleEnum1783930300000 implements MigrationInterface {
  name = 'ContractLifecycleEnum1783930300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."contract_status" ADD VALUE IF NOT EXISTS 'PENDING_SIGNATURE'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."contract_status" ADD VALUE IF NOT EXISTS 'PAYMENT_PENDING'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."contract_status" ADD VALUE IF NOT EXISTS 'ENDING'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."contract_status" ADD VALUE IF NOT EXISTS 'CANCELLED'`,
    );
  }

  // PostgreSQL enum values are intentionally retained on revert. The following
  // migration removes all persisted uses, so the legacy application remains compatible.
  public down(): Promise<void> {
    return Promise.resolve();
  }
}
