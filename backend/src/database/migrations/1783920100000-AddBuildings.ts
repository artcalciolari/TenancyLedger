import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBuildings1783920100000 implements MigrationInterface {
  name = 'AddBuildings1783920100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "buildings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(120) NOT NULL,
        "neighborhood" character varying(120) NOT NULL,
        "address" character varying(200),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_buildings" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_buildings_name_not_blank" CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
        CONSTRAINT "CHK_buildings_neighborhood_not_blank"
          CHECK (char_length(trim(neighborhood)) BETWEEN 1 AND 120),
        CONSTRAINT "CHK_buildings_address_not_blank"
          CHECK (address IS NULL OR char_length(trim(address)) BETWEEN 1 AND 200)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_buildings_name_ci" ON "buildings" (lower(name))`,
    );

    await queryRunner.query(`ALTER TABLE "property_units" ADD "building_id" uuid`);
    await queryRunner.query(`
      ALTER TABLE "property_units"
      ADD CONSTRAINT "FK_property_units_building"
      FOREIGN KEY ("building_id") REFERENCES "buildings"("id")
      ON DELETE RESTRICT ON UPDATE RESTRICT
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_property_units_building_id" ON "property_units" ("building_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_property_units_building_id"`);
    await queryRunner.query(
      `ALTER TABLE "property_units" DROP CONSTRAINT "FK_property_units_building"`,
    );
    await queryRunner.query(`ALTER TABLE "property_units" DROP COLUMN "building_id"`);

    await queryRunner.query(`DROP INDEX "public"."UQ_buildings_name_ci"`);
    await queryRunner.query(`DROP TABLE "buildings"`);
  }
}
