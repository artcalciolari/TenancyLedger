import { PropertyUnit } from './property-unit.entity';

export const PROPERTY_REPOSITORY_TOKEN = Symbol('PROPERTY_REPOSITORY_TOKEN');

export interface PropertyListOptions {
  page: number;
  limit: number;
  q?: string;
  type?: PropertyUnit['type'];
  buildingId?: string;
  asOf: string;
}

export interface PropertyWithOccupancy {
  property: PropertyUnit;
  buildingName: string | null;
  occupied: boolean;
}

export interface PropertyListResult {
  items: PropertyWithOccupancy[];
  total: number;
}

export interface IPropertyRepository {
  save(property: PropertyUnit): Promise<PropertyUnit>;
  findById(id: string): Promise<PropertyUnit | null>;
  findByLocation(neighborhood: string, unitNumber: string): Promise<PropertyUnit | null>;
  list(options: PropertyListOptions): Promise<PropertyListResult>;
  getView(id: string, asOf: string): Promise<PropertyWithOccupancy | null>;
}
