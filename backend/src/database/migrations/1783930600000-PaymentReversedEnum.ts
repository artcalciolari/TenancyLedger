import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentReversedEnum1783930600000 implements MigrationInterface {
  name = 'PaymentReversedEnum1783930600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."payment_status" ADD VALUE IF NOT EXISTS 'REVERSED'`,
    );
  }

  // See ContractLifecycleEnum: retaining an unused PostgreSQL enum label makes
  // rollback safe without rebuilding every trigger that depends on the type.
  public down(): Promise<void> {
    return Promise.resolve();
  }
}
