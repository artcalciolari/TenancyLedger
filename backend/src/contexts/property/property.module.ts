import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyUnit } from './domain/property-unit.entity';
import { Building } from './domain/building.entity';
import { PROPERTY_REPOSITORY_TOKEN } from './domain/property.repository';
import { BUILDING_REPOSITORY_TOKEN } from './domain/building.repository';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';
import { BuildingController } from './building.controller';
import { BuildingService } from './building.service';
import { PropertyTypeOrmRepository } from './infrastructure/property.typeorm.repository';
import { BuildingTypeOrmRepository } from './infrastructure/building.typeorm.repository';

@Module({
  imports: [TypeOrmModule.forFeature([PropertyUnit, Building])],
  controllers: [PropertyController, BuildingController],
  providers: [
    PropertyService,
    BuildingService,
    { provide: PROPERTY_REPOSITORY_TOKEN, useClass: PropertyTypeOrmRepository },
    { provide: BUILDING_REPOSITORY_TOKEN, useClass: BuildingTypeOrmRepository },
  ],
  exports: [PropertyService, BuildingService, PROPERTY_REPOSITORY_TOKEN, TypeOrmModule],
})
export class PropertyModule {}
