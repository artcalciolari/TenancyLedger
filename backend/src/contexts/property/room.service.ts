import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Room } from './domain/room.entity';
import { ROOM_REPOSITORY_TOKEN } from './domain/room.repository';
import type {
  IRoomRepository,
  RoomAvailabilityStatus,
  RoomWithOccupancy,
} from './domain/room.repository';
import { Building } from './domain/building.entity';
import { civilDateInTimeZone } from '../../core/domain/civil-date';
import { ValidationError } from '../../core/domain/errors/validation.error';

export interface CreateRoomInput {
  buildingId: string;
  number: string;
}

export interface UpdateRoomInput {
  number?: string;
  buildingId?: string;
}

export interface RoomView {
  id: string;
  buildingId: string;
  number: string;
  createdAt: Date;
  buildingName: string;
  buildingNeighborhood: string;
  buildingAddress: string | null;
  occupied: boolean;
}

export interface PaginatedRoomsView {
  data: RoomView[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ListRoomsInput {
  page: number;
  limit: number;
  q?: string;
  buildingId?: string;
  status?: RoomAvailabilityStatus;
  date?: string;
}

@Injectable()
export class RoomService {
  constructor(
    @Inject(ROOM_REPOSITORY_TOKEN)
    private readonly repository: IRoomRepository,
    @InjectRepository(Building)
    private readonly buildingRepository: Repository<Building>,
  ) {}

  async create(input: CreateRoomInput): Promise<Room> {
    const building = await this.buildingRepository.findOneBy({ id: input.buildingId });
    if (!building) {
      throw new NotFoundException('Prédio não encontrado.');
    }
    const room = Room.create(input.buildingId, input.number);
    const duplicate = await this.repository.findByBuildingNumber(room.buildingId, room.number);
    if (duplicate) {
      throw RoomService.duplicateConflict();
    }
    try {
      return await this.repository.save(room);
    } catch (error: unknown) {
      if (this.databaseErrorCode(error) === '23505') {
        throw RoomService.duplicateConflict();
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateRoomInput): Promise<Room> {
    const room = await this.repository.findById(id);
    if (!room) {
      throw new NotFoundException('Quarto não encontrado.');
    }
    if (input.buildingId !== undefined) {
      throw new ValidationError('O vínculo do quarto com o prédio é imutável.');
    }
    room.update(input);
    const duplicate = await this.repository.findByBuildingNumber(room.buildingId, room.number);
    if (duplicate && duplicate.id !== room.id) {
      throw RoomService.duplicateConflict();
    }
    try {
      return await this.repository.save(room);
    } catch (error: unknown) {
      if (this.databaseErrorCode(error) === '23505') {
        throw RoomService.duplicateConflict();
      }
      throw error;
    }
  }

  async getById(id: string): Promise<RoomView> {
    const view = await this.repository.getView(id, this.currentCivilDate());
    if (!view) {
      throw new NotFoundException('Quarto não encontrado.');
    }
    return RoomService.toView(view);
  }

  async list(input: ListRoomsInput = { page: 1, limit: 20 }): Promise<PaginatedRoomsView> {
    const { page, limit } = input;
    const asOf = input.date ?? this.currentCivilDate();
    const result = await this.repository.list({ ...input, asOf });
    return {
      data: result.items.map((item) => RoomService.toView(item)),
      meta: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
    };
  }

  static toView({
    room,
    buildingName,
    buildingNeighborhood,
    buildingAddress,
    occupied,
  }: RoomWithOccupancy): RoomView {
    return {
      id: room.id,
      buildingId: room.buildingId,
      number: room.number,
      createdAt: room.createdAt,
      buildingName,
      buildingNeighborhood,
      buildingAddress,
      occupied,
    };
  }

  private currentCivilDate(): string {
    return civilDateInTimeZone(new Date());
  }

  private static duplicateConflict(): ConflictException {
    return new ConflictException('Já existe um quarto com este número neste prédio.');
  }

  private databaseErrorCode(error: unknown): string | undefined {
    if (!(error instanceof QueryFailedError)) return undefined;
    const driverError: unknown = error.driverError;
    if (typeof driverError !== 'object' || driverError === null) return undefined;
    const code = Reflect.get(driverError, 'code') as unknown;
    return typeof code === 'string' ? code : undefined;
  }
}
