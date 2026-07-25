import { MigrationInterface, QueryRunner } from 'typeorm';

export class UnifyRoomsDomain1783950000000 implements MigrationInterface {
  name = 'UnifyRoomsDomain1783950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contracts" DROP CONSTRAINT "EX_contracts_no_overlapping_period"`,
    );
    await queryRunner.query(`ALTER TABLE "contracts" DROP CONSTRAINT "FK_contracts_property_unit"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_contracts_property_unit_id"`);

    await queryRunner.query(`
      CREATE TABLE "rooms" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "building_id" uuid NOT NULL,
        "number" character varying(40) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_rooms_number_not_blank" CHECK (char_length(trim(number)) > 0),
        CONSTRAINT "PK_rooms" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_rooms_building_number_ci" ON "rooms" ("building_id", lower("number"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_rooms_building_id" ON "rooms" ("building_id")`);
    await queryRunner.query(`
      ALTER TABLE "rooms"
      ADD CONSTRAINT "FK_rooms_building"
      FOREIGN KEY ("building_id") REFERENCES "buildings"("id")
      ON DELETE RESTRICT ON UPDATE RESTRICT
    `);

    await queryRunner.query(`DROP TABLE "property_units"`);
    await queryRunner.query(`DROP TYPE "public"."property_unit_type"`);

    await queryRunner.query(
      `ALTER TABLE "contracts" RENAME COLUMN "property_unit_id" TO "room_id"`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_contracts_room_id" ON "contracts" ("room_id")`);
    await queryRunner.query(`
      ALTER TABLE "contracts"
      ADD CONSTRAINT "FK_contracts_room"
      FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
      ON DELETE RESTRICT ON UPDATE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "contracts" ADD CONSTRAINT "EX_contracts_no_overlapping_period"
      EXCLUDE USING gist (
        "room_id" WITH =,
        daterange("move_in_date", COALESCE("end_date", 'infinity'::date), '[]') WITH &&
      ) WHERE ("status" NOT IN ('TERMINATED'::"contract_status", 'CANCELLED'::"contract_status"))
    `);

    await queryRunner.query(`ALTER TABLE "receipts" RENAME COLUMN "property_unit_id" TO "room_id"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "receipts" RENAME COLUMN "room_id" TO "property_unit_id"`);

    await queryRunner.query(
      `ALTER TABLE "contracts" DROP CONSTRAINT "EX_contracts_no_overlapping_period"`,
    );
    await queryRunner.query(`ALTER TABLE "contracts" DROP CONSTRAINT "FK_contracts_room"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_contracts_room_id"`);
    await queryRunner.query(
      `ALTER TABLE "contracts" RENAME COLUMN "room_id" TO "property_unit_id"`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."property_unit_type" AS ENUM('KITNET', 'ROOM', 'APARTMENT', 'HOUSE', 'COMMERCIAL')`,
    );
    await queryRunner.query(`
      CREATE TABLE "property_units" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "neighborhood" character varying(120) NOT NULL,
        "type" "public"."property_unit_type" NOT NULL,
        "unit_number" character varying(40) NOT NULL,
        "building_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_property_units_unit_number_not_blank" CHECK (char_length(trim(unit_number)) > 0),
        CONSTRAINT "CHK_property_units_neighborhood_not_blank" CHECK (char_length(trim(neighborhood)) > 0),
        CONSTRAINT "PK_c7d7d8f633643123e9f9e0a0c83" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_property_units_building_unit_ci" ON "property_units" ("building_id", lower("unit_number"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_property_units_location_ci" ON "property_units" (lower("neighborhood"), lower("unit_number"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_property_units_building_id" ON "property_units" ("building_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "property_units"
      ADD CONSTRAINT "FK_property_units_building"
      FOREIGN KEY ("building_id") REFERENCES "buildings"("id")
      ON DELETE RESTRICT ON UPDATE RESTRICT
    `);

    await queryRunner.query(`ALTER TABLE "rooms" DROP CONSTRAINT "FK_rooms_building"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_rooms_building_id"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_rooms_building_number_ci"`);
    await queryRunner.query(`DROP TABLE "rooms"`);

    await queryRunner.query(
      `CREATE INDEX "IDX_contracts_property_unit_id" ON "contracts" ("property_unit_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "contracts"
      ADD CONSTRAINT "FK_contracts_property_unit"
      FOREIGN KEY ("property_unit_id") REFERENCES "property_units"("id")
      ON DELETE RESTRICT ON UPDATE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "contracts" ADD CONSTRAINT "EX_contracts_no_overlapping_period"
      EXCLUDE USING gist (
        "property_unit_id" WITH =,
        daterange("move_in_date", COALESCE("end_date", 'infinity'::date), '[]') WITH &&
      ) WHERE ("status" NOT IN ('TERMINATED'::"contract_status", 'CANCELLED'::"contract_status"))
    `);
  }
}
