import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Room } from '../domain/room.entity';
import {
  IRoomRepository,
  RoomListOptions,
  RoomListResult,
  RoomWithOccupancy,
} from '../domain/room.repository';

interface OccupancyRaw {
  buildingName: string;
  buildingNeighborhood: string;
  buildingAddress: string | null;
  occupied: boolean;
}

@Injectable()
export class RoomTypeOrmRepository implements IRoomRepository {
  constructor(
    @InjectRepository(Room)
    private readonly repository: Repository<Room>,
  ) {}

  save(room: Room): Promise<Room> {
    return this.repository.save(room);
  }

  findById(id: string): Promise<Room | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByBuildingNumber(buildingId: string, number: string): Promise<Room | null> {
    return this.repository
      .createQueryBuilder('room')
      .where('room.building_id = :buildingId', { buildingId })
      .andWhere('lower(room.number) = lower(:number)', { number })
      .getOne();
  }

  async list({
    page,
    limit,
    q,
    buildingId,
    status,
    asOf,
  }: RoomListOptions): Promise<RoomListResult> {
    const query = this.occupancyQuery(asOf)
      .orderBy('room.createdAt', 'DESC')
      .addOrderBy('room.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);
    const term = q?.trim();
    if (term) {
      const escaped = term.replace(/[\\%_]/g, (character) => `\\${character}`);
      query.andWhere(
        `(
          room.number ILIKE :q ESCAPE '\\'
          OR building.name ILIKE :q ESCAPE '\\'
          OR building.neighborhood ILIKE :q ESCAPE '\\'
          OR building.address ILIKE :q ESCAPE '\\'
        )`,
        { q: `%${escaped}%` },
      );
    }
    if (buildingId) query.andWhere('room.building_id = :buildingId', { buildingId });
    if (status === 'VACANT') query.andWhere('contract.id IS NULL');
    if (status === 'OCCUPIED') query.andWhere('contract.id IS NOT NULL');

    const total = await query.clone().getCount();
    const { entities, raw } = await query.getRawAndEntities<OccupancyRaw>();
    return {
      items: entities.map((room, index) => RoomTypeOrmRepository.toView(room, raw[index])),
      total,
    };
  }

  async getView(id: string, asOf: string): Promise<RoomWithOccupancy | null> {
    const { entities, raw } = await this.occupancyQuery(asOf)
      .andWhere('room.id = :id', { id })
      .getRawAndEntities<OccupancyRaw>();
    const [entity] = entities;
    if (!entity) return null;
    return RoomTypeOrmRepository.toView(entity, raw[0]);
  }

  private occupancyQuery(asOf: string): SelectQueryBuilder<Room> {
    return this.repository
      .createQueryBuilder('room')
      .innerJoin('buildings', 'building', 'building.id = room.building_id')
      .leftJoin(
        'contracts',
        'contract',
        `contract.room_id = room.id
          AND contract.status::text NOT IN ('TERMINATED', 'CANCELLED')
          AND contract.move_in_date <= :asOf
          AND COALESCE(contract.end_date, 'infinity'::date) >= :asOf`,
        { asOf },
      )
      .addSelect('building.name', 'buildingName')
      .addSelect('building.neighborhood', 'buildingNeighborhood')
      .addSelect('building.address', 'buildingAddress')
      .addSelect('(contract.id IS NOT NULL)', 'occupied');
  }

  private static toView(room: Room, raw: OccupancyRaw | undefined): RoomWithOccupancy {
    if (!raw) throw new Error(`Missing occupancy projection for room ${room.id}`);
    return {
      room,
      buildingName: raw.buildingName,
      buildingNeighborhood: raw.buildingNeighborhood,
      buildingAddress: raw.buildingAddress,
      occupied: Boolean(raw.occupied),
    };
  }
}
