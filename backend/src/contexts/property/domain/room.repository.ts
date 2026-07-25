import { Room } from './room.entity';

export const ROOM_REPOSITORY_TOKEN = Symbol('ROOM_REPOSITORY_TOKEN');

export type RoomAvailabilityStatus = 'VACANT' | 'OCCUPIED';

export interface RoomListOptions {
  page: number;
  limit: number;
  q?: string;
  buildingId?: string;
  status?: RoomAvailabilityStatus;
  asOf: string;
}

export interface RoomWithOccupancy {
  room: Room;
  buildingName: string;
  buildingNeighborhood: string;
  buildingAddress: string | null;
  occupied: boolean;
}

export interface RoomListResult {
  items: RoomWithOccupancy[];
  total: number;
}

export interface IRoomRepository {
  save(room: Room): Promise<Room>;
  findById(id: string): Promise<Room | null>;
  findByBuildingNumber(buildingId: string, number: string): Promise<Room | null>;
  list(options: RoomListOptions): Promise<RoomListResult>;
  getView(id: string, asOf: string): Promise<RoomWithOccupancy | null>;
}
