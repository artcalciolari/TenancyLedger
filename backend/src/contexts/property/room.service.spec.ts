import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { Room } from './domain/room.entity';
import { Building } from './domain/building.entity';
import type { IRoomRepository, RoomWithOccupancy } from './domain/room.repository';
import { RoomService } from './room.service';
import { ValidationError } from '../../core/domain/errors/validation.error';

const ROOM_ID = 'c2926b25-4e17-44a8-8097-9c093f842cbb';
const OTHER_ROOM_ID = 'f14f0701-daad-478c-a7ac-5ccb6b96a6af';
const BUILDING_ID = '3d6f0c9e-3c9a-4d3b-9d0a-8f6e5c1a2b3c';
const CREATED_AT = new Date('2026-07-12T12:00:00.000Z');

function persistedBuilding(id = BUILDING_ID): Building {
  const building = Building.create(`Prédio ${id}`, 'Jardim América');
  Object.defineProperty(building, 'id', { value: id, configurable: true });
  return building;
}

function persistedRoom(buildingId = BUILDING_ID, id = ROOM_ID): Room {
  const room = Room.create(buildingId, '  Bloco A   101 ');
  Object.defineProperties(room, {
    id: { value: id, configurable: true },
    createdAt: { value: CREATED_AT, configurable: true },
  });
  return room;
}

function withOccupancy(
  room: Room,
  buildingName = 'Edifício Aurora',
  occupied = false,
): RoomWithOccupancy {
  return {
    room,
    buildingName,
    buildingNeighborhood: 'Jardim América',
    buildingAddress: 'Rua das Flores, 123',
    occupied,
  };
}

function queryFailure(code: string): QueryFailedError {
  const driverError = Object.assign(new Error(`PostgreSQL ${code}`), { code });
  return new QueryFailedError('INSERT INTO rooms', [], driverError);
}

function queryFailureWithDriverError(driverError: unknown): QueryFailedError {
  const error = new QueryFailedError('INSERT INTO rooms', [], new Error('PostgreSQL failure'));
  Object.defineProperty(error, 'driverError', { value: driverError });
  return error;
}

describe('RoomService', () => {
  let repository: jest.Mocked<IRoomRepository>;
  let buildingRepository: jest.Mocked<Pick<Repository<Building>, 'findOneBy'>>;
  let service: RoomService;
  let save: jest.MockedFunction<IRoomRepository['save']>;
  let findById: jest.MockedFunction<IRoomRepository['findById']>;
  let findByBuildingNumber: jest.MockedFunction<IRoomRepository['findByBuildingNumber']>;
  let list: jest.MockedFunction<IRoomRepository['list']>;
  let getView: jest.MockedFunction<IRoomRepository['getView']>;

  beforeEach(() => {
    save = jest.fn().mockImplementation((room: Room) => Promise.resolve(room));
    findById = jest.fn().mockResolvedValue(null);
    findByBuildingNumber = jest.fn().mockResolvedValue(null);
    list = jest.fn().mockResolvedValue({ items: [], total: 0 });
    getView = jest.fn().mockResolvedValue(null);
    repository = { save, findById, findByBuildingNumber, list, getView };
    buildingRepository = {
      findOneBy: jest.fn().mockResolvedValue(persistedBuilding()),
    };
    service = new RoomService(repository, buildingRepository as unknown as Repository<Building>);
  });

  describe('create', () => {
    it('validates the building exists and persists a room', async () => {
      const result = await service.create({ buildingId: BUILDING_ID, number: '  101   A ' });

      expect(buildingRepository.findOneBy).toHaveBeenCalledWith({ id: BUILDING_ID });
      expect(result).toMatchObject({ buildingId: BUILDING_ID, number: '101 A' });
      expect(findByBuildingNumber).toHaveBeenCalledWith(BUILDING_ID, '101 A');
      expect(save).toHaveBeenCalledWith(result);
    });

    it('rejects an unknown building', async () => {
      buildingRepository.findOneBy.mockResolvedValue(null);

      await expect(service.create({ buildingId: BUILDING_ID, number: '101' })).rejects.toThrow(
        new NotFoundException('Prédio não encontrado.'),
      );
      expect(save).not.toHaveBeenCalled();
    });

    it('rejects a duplicate room number inside the same building', async () => {
      findByBuildingNumber.mockResolvedValue(persistedRoom());

      await expect(service.create({ buildingId: BUILDING_ID, number: '101' })).rejects.toThrow(
        new ConflictException('Já existe um quarto com este número neste prédio.'),
      );
      expect(save).not.toHaveBeenCalled();
    });

    it('maps a concurrent PostgreSQL unique violation to a conflict', async () => {
      save.mockRejectedValue(queryFailure('23505'));

      await expect(service.create({ buildingId: BUILDING_ID, number: '101' })).rejects.toThrow(
        new ConflictException('Já existe um quarto com este número neste prédio.'),
      );
    });

    it('preserves an unexpected persistence error', async () => {
      const error = new Error('database unavailable');
      save.mockRejectedValue(error);

      await expect(service.create({ buildingId: BUILDING_ID, number: '101' })).rejects.toBe(error);
    });

    it('preserves a query failure whose driver error has no metadata object', async () => {
      const error = queryFailureWithDriverError(null);
      save.mockRejectedValue(error);

      await expect(service.create({ buildingId: BUILDING_ID, number: '101' })).rejects.toBe(error);
    });

    it('preserves a query failure whose database code is not a string', async () => {
      const error = queryFailureWithDriverError({ code: 23505 });
      save.mockRejectedValue(error);

      await expect(service.create({ buildingId: BUILDING_ID, number: '101' })).rejects.toBe(error);
    });
  });

  describe('update', () => {
    it('updates the room number', async () => {
      const room = persistedRoom();
      findById.mockResolvedValue(room);

      await expect(service.update(ROOM_ID, { number: ' 202   B ' })).resolves.toBe(room);

      expect(room).toMatchObject({ number: '202 B' });
      expect(findByBuildingNumber).toHaveBeenCalledWith(BUILDING_ID, '202 B');
      expect(save).toHaveBeenCalledWith(room);
    });

    it('rejects an unknown room', async () => {
      await expect(service.update(ROOM_ID, { number: '202' })).rejects.toThrow(
        new NotFoundException('Quarto não encontrado.'),
      );
      expect(save).not.toHaveBeenCalled();
    });

    it('rejects an attempt to change the building link', async () => {
      findById.mockResolvedValue(persistedRoom());

      await expect(service.update(ROOM_ID, { buildingId: BUILDING_ID })).rejects.toThrow(
        new ValidationError('O vínculo do quarto com o prédio é imutável.'),
      );
      expect(save).not.toHaveBeenCalled();
    });

    it('rejects a duplicate number during update', async () => {
      findById.mockResolvedValue(persistedRoom());
      findByBuildingNumber.mockResolvedValue(persistedRoom(BUILDING_ID, OTHER_ROOM_ID));

      await expect(service.update(ROOM_ID, { number: '202' })).rejects.toThrow(
        new ConflictException('Já existe um quarto com este número neste prédio.'),
      );
      expect(save).not.toHaveBeenCalled();
    });

    it('maps a concurrent unique violation during update to a conflict', async () => {
      findById.mockResolvedValue(persistedRoom());
      save.mockRejectedValue(queryFailure('23505'));

      await expect(service.update(ROOM_ID, { number: '202' })).rejects.toThrow(
        new ConflictException('Já existe um quarto com este número neste prédio.'),
      );
    });

    it('preserves an unexpected persistence error during update', async () => {
      const error = new Error('database unavailable');
      findById.mockResolvedValue(persistedRoom());
      save.mockRejectedValue(error);

      await expect(service.update(ROOM_ID, { number: '202' })).rejects.toBe(error);
    });
  });

  describe('getById', () => {
    it('returns the room view found by id', async () => {
      const room = persistedRoom();
      getView.mockResolvedValue(withOccupancy(room, 'Edifício Aurora', true));

      await expect(service.getById(ROOM_ID)).resolves.toEqual({
        id: ROOM_ID,
        buildingId: BUILDING_ID,
        number: 'Bloco A 101',
        createdAt: CREATED_AT,
        buildingName: 'Edifício Aurora',
        buildingNeighborhood: 'Jardim América',
        buildingAddress: 'Rua das Flores, 123',
        occupied: true,
      });
      expect(getView).toHaveBeenCalledWith(ROOM_ID, expect.any(String));
    });

    it('rejects an unknown room', async () => {
      await expect(service.getById(ROOM_ID)).rejects.toThrow(
        new NotFoundException('Quarto não encontrado.'),
      );
    });
  });

  describe('list', () => {
    it('returns paginated room views', async () => {
      const room = persistedRoom();
      list.mockResolvedValue({ items: [withOccupancy(room)], total: 41 });

      await expect(service.list({ page: 3, limit: 20 })).resolves.toEqual({
        data: [
          {
            id: ROOM_ID,
            buildingId: BUILDING_ID,
            number: 'Bloco A 101',
            createdAt: CREATED_AT,
            buildingName: 'Edifício Aurora',
            buildingNeighborhood: 'Jardim América',
            buildingAddress: 'Rua das Flores, 123',
            occupied: false,
          },
        ],
        meta: { page: 3, limit: 20, total: 41, totalPages: 3 },
      });
      const [call] = list.mock.calls;
      expect(call?.[0]).toMatchObject({ page: 3, limit: 20 });
      expect(call?.[0].asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('uses the requested date when filtering availability', async () => {
      await service.list({ page: 1, limit: 20, status: 'VACANT', date: '2026-08-01' });

      const [call] = list.mock.calls;
      expect(call?.[0]).toMatchObject({ status: 'VACANT', asOf: '2026-08-01' });
    });

    it('defaults to the current civil date', async () => {
      await service.list();

      const [call] = list.mock.calls;
      expect(call?.[0].asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('maps only public room fields in toView', () => {
    expect(RoomService.toView(withOccupancy(persistedRoom(), 'Edifício Aurora', true))).toEqual({
      id: ROOM_ID,
      buildingId: BUILDING_ID,
      number: 'Bloco A 101',
      createdAt: CREATED_AT,
      buildingName: 'Edifício Aurora',
      buildingNeighborhood: 'Jardim América',
      buildingAddress: 'Rua das Flores, 123',
      occupied: true,
    });
  });
});
