import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { Building } from './domain/building.entity';
import { BUILDING_REPOSITORY_TOKEN } from './domain/building.repository';
import type { BuildingUnitView, IBuildingRepository } from './domain/building.repository';
import { civilDateInTimeZone } from '../../core/domain/civil-date';

export interface CreateBuildingInput {
  name: string;
  neighborhood: string;
  address?: string | null;
}

export interface BuildingView {
  id: string;
  name: string;
  neighborhood: string;
  address: string | null;
  createdAt: Date;
  totalUnits: number;
  occupiedUnits: number;
}

export interface BuildingDetailView extends BuildingView {
  units: BuildingUnitView[];
}

export interface PaginatedBuildingsView {
  data: BuildingView[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ListBuildingsInput {
  page: number;
  limit: number;
  q?: string;
}

@Injectable()
export class BuildingService {
  constructor(
    @Inject(BUILDING_REPOSITORY_TOKEN)
    private readonly repository: IBuildingRepository,
  ) {}

  async create(input: CreateBuildingInput): Promise<Building> {
    const building = Building.create(input.name, input.neighborhood, input.address);
    const duplicate = await this.repository.findByName(building.name);
    if (duplicate) {
      throw new ConflictException('Já existe um prédio com este nome.');
    }
    try {
      return await this.repository.save(building);
    } catch (error: unknown) {
      if (this.databaseErrorCode(error) === '23505') {
        throw new ConflictException('Já existe um prédio com este nome.');
      }
      throw error;
    }
  }

  async list(input: ListBuildingsInput): Promise<PaginatedBuildingsView> {
    const { page, limit } = input;
    const asOf = this.currentCivilDate();
    const result = await this.repository.list({ ...input, asOf });
    return {
      data: result.items,
      meta: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
    };
  }

  async getById(id: string): Promise<BuildingDetailView> {
    const asOf = this.currentCivilDate();
    const [occupancy, units] = await Promise.all([
      this.repository.occupancyFor(id, asOf),
      this.repository.listUnits(id, asOf),
    ]);
    if (!occupancy) {
      throw new NotFoundException('Prédio não encontrado.');
    }
    return { ...occupancy, units };
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
