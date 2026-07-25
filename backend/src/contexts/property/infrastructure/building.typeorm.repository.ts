import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Building } from '../domain/building.entity';
import {
  BuildingListOptions,
  BuildingListResult,
  BuildingOccupancyView,
  BuildingRoomView,
  BuildingVacancyFilter,
  IBuildingRepository,
} from '../domain/building.repository';

interface BuildingOccupancyRow {
  id: string;
  name: string;
  neighborhood: string;
  address: string | null;
  createdAt: Date;
  totalRooms: string;
  occupiedRooms: string;
}

interface AggregateCountRow {
  total: string;
}

@Injectable()
export class BuildingTypeOrmRepository implements IBuildingRepository {
  constructor(
    @InjectRepository(Building)
    private readonly repository: Repository<Building>,
  ) {}

  save(building: Building): Promise<Building> {
    return this.repository.save(building);
  }

  findById(id: string): Promise<Building | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByName(name: string): Promise<Building | null> {
    return this.repository
      .createQueryBuilder('building')
      .where('lower(building.name) = lower(:name)', { name })
      .getOne();
  }

  async list({ page, limit, q, asOf, vacancy }: BuildingListOptions): Promise<BuildingListResult> {
    const query = this.aggregateQuery(asOf);
    const term = q?.trim();
    if (term) {
      const escaped = term.replace(/[\\%_]/g, (character) => `\\${character}`);
      const filter = `(
          building.name ILIKE :q ESCAPE '\\'
          OR building.neighborhood ILIKE :q ESCAPE '\\'
          OR building.address ILIKE :q ESCAPE '\\'
        )`;
      query.andWhere(filter, { q: `%${escaped}%` });
    }
    if (vacancy) query.having(BuildingTypeOrmRepository.vacancyHaving(vacancy));

    const countSource = query.clone();
    const countRow = await this.repository.manager
      .createQueryBuilder()
      .select('COUNT(*)', 'total')
      .from(`(${countSource.getQuery()})`, 'filtered_buildings')
      .setParameters(countSource.getParameters())
      .getRawOne<AggregateCountRow>();
    const rows = await query
      .orderBy(BuildingTypeOrmRepository.vacancyOrderExpression(), 'DESC', 'NULLS LAST')
      .addOrderBy('lower(building.name)', 'ASC')
      .addOrderBy('building.id', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<BuildingOccupancyRow>();
    const total = Number(countRow?.total ?? 0);
    return { items: rows.map((row) => BuildingTypeOrmRepository.toOccupancyView(row)), total };
  }

  async occupancyFor(id: string, asOf: string): Promise<BuildingOccupancyView | null> {
    const row = await this.aggregateQuery(asOf)
      .andWhere('building.id = :id', { id })
      .getRawOne<BuildingOccupancyRow>();
    return row ? BuildingTypeOrmRepository.toOccupancyView(row) : null;
  }

  async listRooms(buildingId: string, asOf: string): Promise<BuildingRoomView[]> {
    return this.repository.manager
      .createQueryBuilder()
      .select('room.id', 'id')
      .addSelect('room.number', 'number')
      .addSelect(
        `EXISTS (
          SELECT 1 FROM contracts contract
          WHERE contract.room_id = room.id
            AND contract.status::text NOT IN ('TERMINATED', 'CANCELLED')
            AND contract.move_in_date <= :asOf
            AND COALESCE(contract.end_date, 'infinity'::date) >= :asOf
        )`,
        'occupied',
      )
      .from('rooms', 'room')
      .where('room.building_id = :buildingId', { buildingId })
      .setParameters({ asOf })
      .orderBy('room.number', 'ASC')
      .getRawMany<BuildingRoomView>();
  }

  private aggregateQuery(asOf: string): SelectQueryBuilder<Building> {
    return this.repository
      .createQueryBuilder('building')
      .leftJoin('rooms', 'room', 'room.building_id = building.id')
      .leftJoin(
        'contracts',
        'contract',
        `contract.room_id = room.id
          AND contract.status::text NOT IN ('TERMINATED', 'CANCELLED')
          AND contract.move_in_date <= :asOf
          AND COALESCE(contract.end_date, 'infinity'::date) >= :asOf`,
        { asOf },
      )
      .select('building.id', 'id')
      .addSelect('building.name', 'name')
      .addSelect('building.neighborhood', 'neighborhood')
      .addSelect('building.address', 'address')
      .addSelect('building.createdAt', 'createdAt')
      .addSelect('COUNT(DISTINCT room.id)', 'totalRooms')
      .addSelect('COUNT(DISTINCT contract.room_id)', 'occupiedRooms')
      .groupBy('building.id');
  }

  private static vacancyHaving(vacancy: BuildingVacancyFilter): string {
    switch (vacancy) {
      case 'NO_ROOMS':
        return 'COUNT(DISTINCT room.id) = 0';
      case 'FULL':
        return 'COUNT(DISTINCT room.id) > 0 AND COUNT(DISTINCT room.id) = COUNT(DISTINCT contract.room_id)';
      case 'WITH_VACANCY':
      default:
        return 'COUNT(DISTINCT room.id) > COUNT(DISTINCT contract.room_id)';
    }
  }

  private static vacancyOrderExpression(): string {
    return `CASE
      WHEN COUNT(DISTINCT room.id) = 0 THEN NULL
      ELSE (
        (COUNT(DISTINCT room.id) - COUNT(DISTINCT contract.room_id))::decimal
        / COUNT(DISTINCT room.id)
      )
    END`;
  }

  private static toOccupancyView(row: BuildingOccupancyRow): BuildingOccupancyView {
    const totalRooms = Number(row.totalRooms);
    const occupiedRooms = Number(row.occupiedRooms);
    const vacantRooms = totalRooms - occupiedRooms;
    const vacancyPercentage =
      totalRooms === 0 ? null : Math.round((vacantRooms / totalRooms) * 1000) / 10;
    return {
      id: row.id,
      name: row.name,
      neighborhood: row.neighborhood,
      address: row.address,
      createdAt: row.createdAt,
      totalRooms,
      occupiedRooms,
      vacantRooms,
      vacancyPercentage,
    };
  }
}
