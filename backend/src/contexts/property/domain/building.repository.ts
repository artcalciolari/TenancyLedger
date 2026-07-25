import { Building } from './building.entity';

export const BUILDING_REPOSITORY_TOKEN = Symbol('BUILDING_REPOSITORY_TOKEN');

export type BuildingVacancyFilter = 'WITH_VACANCY' | 'FULL' | 'NO_ROOMS';

export interface BuildingMetrics {
  totalRooms: number;
  occupiedRooms: number;
  vacantRooms: number;
  vacancyPercentage: number | null;
}

export interface BuildingOccupancyView extends BuildingMetrics {
  id: string;
  name: string;
  neighborhood: string;
  address: string | null;
  createdAt: Date;
}

export interface BuildingRoomView {
  id: string;
  number: string;
  occupied: boolean;
}

export interface BuildingListOptions {
  page: number;
  limit: number;
  q?: string;
  asOf: string;
  vacancy?: BuildingVacancyFilter;
}

export interface BuildingListResult {
  items: BuildingOccupancyView[];
  total: number;
}

export interface IBuildingRepository {
  save(building: Building): Promise<Building>;
  findById(id: string): Promise<Building | null>;
  findByName(name: string): Promise<Building | null>;
  list(options: BuildingListOptions): Promise<BuildingListResult>;
  occupancyFor(id: string, asOf: string): Promise<BuildingOccupancyView | null>;
  listRooms(buildingId: string, asOf: string): Promise<BuildingRoomView[]>;
}
