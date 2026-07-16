import { Building } from './building.entity';
import { UnitType } from './property-unit.entity';

export const BUILDING_REPOSITORY_TOKEN = Symbol('BUILDING_REPOSITORY_TOKEN');

export interface BuildingOccupancyView {
  id: string;
  name: string;
  neighborhood: string;
  address: string | null;
  createdAt: Date;
  totalUnits: number;
  occupiedUnits: number;
}

export interface BuildingUnitView {
  id: string;
  unitNumber: string;
  type: UnitType;
  neighborhood: string;
  occupied: boolean;
}

export interface BuildingListOptions {
  page: number;
  limit: number;
  q?: string;
  asOf: string;
}

export interface BuildingListResult {
  items: BuildingOccupancyView[];
  total: number;
}

export interface IBuildingRepository {
  save(building: Building): Promise<Building>;
  saveWithUnitNeighborhoodPropagation(
    building: Building,
    propagateNeighborhood: boolean,
  ): Promise<Building>;
  findById(id: string): Promise<Building | null>;
  findByName(name: string): Promise<Building | null>;
  list(options: BuildingListOptions): Promise<BuildingListResult>;
  occupancyFor(id: string, asOf: string): Promise<BuildingOccupancyView | null>;
  listUnits(buildingId: string, asOf: string): Promise<BuildingUnitView[]>;
}
