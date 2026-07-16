import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { PropertyUnit } from '../domain/property-unit.entity';
import {
  IPropertyRepository,
  PropertyListOptions,
  PropertyListResult,
  PropertyWithOccupancy,
} from '../domain/property.repository';

interface OccupancyRaw {
  buildingName: string | null;
  occupied: boolean;
}

@Injectable()
export class PropertyTypeOrmRepository implements IPropertyRepository {
  constructor(
    @InjectRepository(PropertyUnit)
    private readonly repository: Repository<PropertyUnit>,
  ) {}

  save(property: PropertyUnit): Promise<PropertyUnit> {
    return this.repository.save(property);
  }

  findById(id: string): Promise<PropertyUnit | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByLocation(neighborhood: string, unitNumber: string): Promise<PropertyUnit | null> {
    return this.repository
      .createQueryBuilder('property')
      .where('lower(property.neighborhood) = lower(:neighborhood)', { neighborhood })
      .andWhere('lower(property.unit_number) = lower(:unitNumber)', { unitNumber })
      .getOne();
  }

  async list({
    page,
    limit,
    q,
    type,
    buildingId,
    asOf,
  }: PropertyListOptions): Promise<PropertyListResult> {
    const query = this.occupancyQuery(asOf)
      .orderBy('property.createdAt', 'DESC')
      .addOrderBy('property.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);
    const term = q?.trim();
    if (term) {
      const escaped = term.replace(/[\\%_]/g, (character) => `\\${character}`);
      query.andWhere(
        `(property.neighborhood ILIKE :q ESCAPE '\\' OR property.unitNumber ILIKE :q ESCAPE '\\')`,
        { q: `%${escaped}%` },
      );
    }
    if (type) query.andWhere('property.type = :type', { type });
    if (buildingId) query.andWhere('property.building_id = :buildingId', { buildingId });

    const total = await query.clone().getCount();
    const { entities, raw } = await query.getRawAndEntities<OccupancyRaw>();
    return {
      items: entities.map((property, index) =>
        PropertyTypeOrmRepository.toView(property, raw[index]),
      ),
      total,
    };
  }

  async getView(id: string, asOf: string): Promise<PropertyWithOccupancy | null> {
    const { entities, raw } = await this.occupancyQuery(asOf)
      .andWhere('property.id = :id', { id })
      .getRawAndEntities<OccupancyRaw>();
    const [entity] = entities;
    if (!entity) return null;
    return PropertyTypeOrmRepository.toView(entity, raw[0]);
  }

  private occupancyQuery(asOf: string): SelectQueryBuilder<PropertyUnit> {
    return this.repository
      .createQueryBuilder('property')
      .leftJoin('buildings', 'building', 'building.id = property.building_id')
      .leftJoin(
        'contracts',
        'contract',
        `contract.property_unit_id = property.id
          AND contract.status = :activeStatus
          AND contract.move_in_date <= :asOf
          AND contract.end_date >= :asOf`,
        { activeStatus: 'ACTIVE', asOf },
      )
      .addSelect('building.name', 'buildingName')
      .addSelect('(contract.id IS NOT NULL)', 'occupied');
  }

  private static toView(
    property: PropertyUnit,
    raw: OccupancyRaw | undefined,
  ): PropertyWithOccupancy {
    return {
      property,
      buildingName: raw?.buildingName ?? null,
      occupied: Boolean(raw?.occupied),
    };
  }
}
