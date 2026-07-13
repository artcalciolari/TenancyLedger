import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { PropertyUnit, UnitType } from './domain/property-unit.entity';
import { PROPERTY_REPOSITORY_TOKEN } from './domain/property.repository';
import type { IPropertyRepository } from './domain/property.repository';

export interface CreatePropertyInput {
  neighborhood: string;
  type: UnitType;
  unitNumber: string;
}

export interface PropertyView {
  id: string;
  neighborhood: string;
  type: UnitType;
  unitNumber: string;
  createdAt: Date;
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
}

@Injectable()
export class PropertyService {
  constructor(
    @Inject(PROPERTY_REPOSITORY_TOKEN)
    private readonly repository: IPropertyRepository,
  ) {}

  async create(input: CreatePropertyInput): Promise<PropertyUnit> {
    const property = PropertyUnit.create(input.neighborhood, input.type, input.unitNumber);
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

  async getById(id: string): Promise<PropertyUnit> {
    const property = await this.repository.findById(id);
    if (!property) {
      throw new NotFoundException('Unidade imobiliária não encontrada.');
    }
    return property;
  }

  async list(
    input: ListPropertiesInput = { page: 1, limit: 20 },
  ): Promise<PaginatedPropertiesView> {
    const { page, limit } = input;
    const result = await this.repository.list(input);
    return {
      data: result.items.map((property) => PropertyService.toView(property)),
      meta: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
    };
  }

  static toView(property: PropertyUnit): PropertyView {
    return {
      id: property.id,
      neighborhood: property.neighborhood,
      type: property.type,
      unitNumber: property.unitNumber,
      createdAt: property.createdAt,
    };
  }

  private databaseErrorCode(error: unknown): string | undefined {
    if (!(error instanceof QueryFailedError)) return undefined;
    const driverError: unknown = error.driverError;
    if (typeof driverError !== 'object' || driverError === null) return undefined;
    const code = Reflect.get(driverError, 'code') as unknown;
    return typeof code === 'string' ? code : undefined;
  }
}
