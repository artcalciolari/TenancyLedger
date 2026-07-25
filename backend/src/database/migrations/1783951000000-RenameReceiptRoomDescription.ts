import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameReceiptRoomDescription1783951000000 implements MigrationInterface {
  name = 'RenameReceiptRoomDescription1783951000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "receipts" RENAME COLUMN "property_description" TO "room_description"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "receipts" RENAME COLUMN "room_description" TO "property_description"`,
    );
  }
}
