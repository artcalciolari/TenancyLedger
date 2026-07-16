import { MigrationInterface, QueryRunner } from 'typeorm';

export class PropertyUnitBuildingCoherence1783920200000 implements MigrationInterface {
  name = 'PropertyUnitBuildingCoherence1783920200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "property_units" DROP CONSTRAINT "UQ_property_units_neighborhood_unit"`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_property_units_location_ci"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_property_units_building_unit_ci"
      ON "property_units" ("building_id", lower("unit_number"))
      WHERE "building_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_property_units_location_ci"
      ON "property_units" (lower("neighborhood"), lower("unit_number"))
      WHERE "building_id" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_property_units_location_ci"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_property_units_building_unit_ci"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_property_units_location_ci" ON "property_units" (lower("neighborhood"), lower("unit_number"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "property_units" ADD CONSTRAINT "UQ_property_units_neighborhood_unit" UNIQUE ("neighborhood", "unit_number")`,
    );
  }
}
