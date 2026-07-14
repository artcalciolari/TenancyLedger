import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { PropertyUnit, UnitType } from './domain/property-unit.entity';
import { PROPERTY_REPOSITORY_TOKEN } from './domain/property.repository';
import type { IPropertyRepository, PropertyWithOccupancy } from './domain/property.repository';
import { Building } from './domain/building.entity';
import { civilDateInTimeZone } from '../../core/domain/civil-date';

export interface CreatePropertyInput {
  neighborhood: string;
  type: UnitType;
  unitNumber: string;
  buildingId?: string | null;
}

export interface PropertyView {
  id: string;
  neighborhood: string;
  type: UnitType;
  unitNumber: string;
  createdAt: Date;
  buildingId: string | null;
  buildingName: string | null;
  occupied: boolean;
}

export interface PaginatedPropertiesView {
  data: PropertyView[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ListPropertiesInput {
  page: number;
  limit: number;
  q?: string;
  type?: UnitType;
  buildingId?: string;
}

@Injectable()
export class PropertyService {
  constructor(
    @Inject(PROPERTY_REPOSITORY_TOKEN)
    private readonly repository: IPropertyRepository,
    @InjectRepository(Building)
    private readonly buildingRepository: Repository<Building>,
  ) {}

  async create(input: CreatePropertyInput): Promise<PropertyUnit> {
    if (input.buildingId) {
      const buildingExists = await this.buildingRepository.existsBy({ id: input.buildingId });
      if (!buildingExists) {
        throw new NotFoundException('Prédio não encontrado.');
      }
    }
    const property = PropertyUnit.create(
      input.neighborhood,
      input.type,
      input.unitNumber,
      input.buildingId,
    );
    const duplicate = await this.repository.findByLocation(
      property.neighborhood,
      property.unitNumber,
    );
    if (duplicate) {
      throw new ConflictException('Já existe uma unidade com este bairro e número.');
    }
    try {
      return await this.repository.save(property);
    } catch (error: unknown) {
      if (this.databaseErrorCode(error) === '23505') {
        throw new ConflictException('Já existe uma unidade com este bairro e número.');
      }
      throw error;
    }
  }

  async getById(id: string): Promise<PropertyView> {
    const view = await this.repository.getView(id, this.currentCivilDate());
    if (!view) {
      throw new NotFoundException('Unidade imobiliária não encontrada.');
    }
    return PropertyService.toView(view);
  }

  async list(
    input: ListPropertiesInput = { page: 1, limit: 20 },
  ): Promise<PaginatedPropertiesView> {
    const { page, limit } = input;
    const result = await this.repository.list({ ...input, asOf: this.currentCivilDate() });
    return {
      data: result.items.map((item) => PropertyService.toView(item)),
      meta: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
    };
  }

  static toView({ property, buildingName, occupied }: PropertyWithOccupancy): PropertyView {
    return {
      id: property.id,
      neighborhood: property.neighborhood,
      type: property.type,
      unitNumber: property.unitNumber,
      createdAt: property.createdAt,
      buildingId: property.buildingId,
      buildingName,
      occupied,
    };
  }

  private currentCivilDate(): string {
    return civilDateInTimeZone(new Date());
  }

  private databaseErrorCode(error: unknown): string | undefined {
    if (!(error instanceof QueryFailedError)) return undefined;
    const driverError: unknown = error.driverError;
    if (typeof driverError !== 'object' || driverError === null) return undefined;
    const code = Reflect.get(driverError, 'code') as unknown;
    return typeof code === 'string' ? code : undefined;
  }
}
