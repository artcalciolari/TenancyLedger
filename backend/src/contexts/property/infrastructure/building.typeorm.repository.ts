import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Building } from '../domain/building.entity';
import {
  BuildingListOptions,
  BuildingListResult,
  BuildingOccupancyView,
  BuildingUnitView,
  IBuildingRepository,
} from '../domain/building.repository';

interface BuildingOccupancyRow {
  id: string;
  name: string;
  neighborhood: string;
  address: string | null;
  createdAt: Date;
  totalUnits: string;
  occupiedUnits: string;
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

  async list({ page, limit, q, asOf }: BuildingListOptions): Promise<BuildingListResult> {
    const baseQuery = this.repository
      .createQueryBuilder('building')
      .leftJoin('property_units', 'unit', 'unit.building_id = building.id')
      .leftJoin(
        'contracts',
        'contract',
        `contract.property_unit_id = unit.id
          AND contract.status = :activeStatus
          AND contract.move_in_date <= :asOf
          AND contract.end_date >= :asOf`,
        { activeStatus: 'ACTIVE', asOf },
      );
    const term = q?.trim();
    if (term) {
      const escaped = term.replace(/[\\%_]/g, (character) => `\\${character}`);
      baseQuery.andWhere(
        `(
          building.name ILIKE :q ESCAPE '\\'
          OR building.neighborhood ILIKE :q ESCAPE '\\'
          OR building.address ILIKE :q ESCAPE '\\'
        )`,
        { q: `%${escaped}%` },
      );
    }

    const total = await baseQuery.clone().getCount();
    const rows = await baseQuery
      .select('building.id', 'id')
      .addSelect('building.name', 'name')
      .addSelect('building.neighborhood', 'neighborhood')
      .addSelect('building.address', 'address')
      .addSelect('building.createdAt', 'createdAt')
      .addSelect('COUNT(DISTINCT unit.id)', 'totalUnits')
      .addSelect('COUNT(DISTINCT contract.property_unit_id)', 'occupiedUnits')
      .groupBy('building.id')
      .orderBy('building.createdAt', 'DESC')
      .addOrderBy('building.id', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<BuildingOccupancyRow>();

    return { items: rows.map((row) => BuildingTypeOrmRepository.toOccupancyView(row)), total };
  }

  async occupancyFor(id: string, asOf: string): Promise<BuildingOccupancyView | null> {
    const row = await this.repository
      .createQueryBuilder('building')
      .leftJoin('property_units', 'unit', 'unit.building_id = building.id')
      .leftJoin(
        'contracts',
        'contract',
        `contract.property_unit_id = unit.id
          AND contract.status = :activeStatus
          AND contract.move_in_date <= :asOf
          AND contract.end_date >= :asOf`,
        { activeStatus: 'ACTIVE', asOf },
      )
      .where('building.id = :id', { id })
      .select('building.id', 'id')
      .addSelect('building.name', 'name')
      .addSelect('building.neighborhood', 'neighborhood')
      .addSelect('building.address', 'address')
      .addSelect('building.createdAt', 'createdAt')
      .addSelect('COUNT(DISTINCT unit.id)', 'totalUnits')
      .addSelect('COUNT(DISTINCT contract.property_unit_id)', 'occupiedUnits')
      .groupBy('building.id')
      .getRawOne<BuildingOccupancyRow>();
    return row ? BuildingTypeOrmRepository.toOccupancyView(row) : null;
  }

  async listUnits(buildingId: string, asOf: string): Promise<BuildingUnitView[]> {
    return this.repository.manager
      .createQueryBuilder()
      .select('unit.id', 'id')
      .addSelect('unit.unit_number', 'unitNumber')
      .addSelect('unit.type', 'type')
      .addSelect('unit.neighborhood', 'neighborhood')
      .addSelect(
        `EXISTS (
          SELECT 1 FROM contracts contract
          WHERE contract.property_unit_id = unit.id
            AND contract.status = :activeStatus
            AND contract.move_in_date <= :asOf
            AND contract.end_date >= :asOf
        )`,
        'occupied',
      )
      .from('property_units', 'unit')
      .where('unit.building_id = :buildingId', { buildingId })
      .setParameters({ activeStatus: 'ACTIVE', asOf })
      .orderBy('unit.unit_number', 'ASC')
      .getRawMany<BuildingUnitView>();
  }

  private static toOccupancyView(row: BuildingOccupancyRow): BuildingOccupancyView {
    return {
      id: row.id,
      name: row.name,
      neighborhood: row.neighborhood,
      address: row.address,
      createdAt: row.createdAt,
      totalUnits: Number(row.totalUnits),
      occupiedUnits: Number(row.occupiedUnits),
    };
  }
}
