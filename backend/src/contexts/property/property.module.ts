import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyUnit } from './domain/property-unit.entity';
import { PROPERTY_REPOSITORY_TOKEN } from './domain/property.repository';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';
import { PropertyTypeOrmRepository } from './infrastructure/property.typeorm.repository';

@Module({
  imports: [TypeOrmModule.forFeature([PropertyUnit])],
  controllers: [PropertyController],
  providers: [
    PropertyService,
    { provide: PROPERTY_REPOSITORY_TOKEN, useClass: PropertyTypeOrmRepository },
  ],
  exports: [PropertyService, PROPERTY_REPOSITORY_TOKEN, TypeOrmModule],
})
export class PropertyModule {}
