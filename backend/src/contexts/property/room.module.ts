import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from './domain/room.entity';
import { Building } from './domain/building.entity';
import { ROOM_REPOSITORY_TOKEN } from './domain/room.repository';
import { BUILDING_REPOSITORY_TOKEN } from './domain/building.repository';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';
import { BuildingController } from './building.controller';
import { BuildingService } from './building.service';
import { RoomTypeOrmRepository } from './infrastructure/room.typeorm.repository';
import { BuildingTypeOrmRepository } from './infrastructure/building.typeorm.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Room, Building])],
  controllers: [RoomController, BuildingController],
  providers: [
    RoomService,
    BuildingService,
    { provide: ROOM_REPOSITORY_TOKEN, useClass: RoomTypeOrmRepository },
    { provide: BUILDING_REPOSITORY_TOKEN, useClass: BuildingTypeOrmRepository },
  ],
  exports: [RoomService, BuildingService, ROOM_REPOSITORY_TOKEN, TypeOrmModule],
})
export class RoomModule {}
