import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PropertyUnit } from '../domain/property-unit.entity';
import {
  IPropertyRepository,
  PropertyListOptions,
  PropertyListResult,
} from '../domain/property.repository';

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

  async list({ page, limit, q, type }: PropertyListOptions): Promise<PropertyListResult> {
    const query = this.repository
      .createQueryBuilder('property')
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
    const [items, total] = await query.getManyAndCount();
    return { items, total };
  }
}
