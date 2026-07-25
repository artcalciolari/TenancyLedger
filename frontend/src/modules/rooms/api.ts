import type {
  CreateRoomInput,
  Paginated,
  RoomListFilters,
  RoomView,
  UpdateRoomInput,
} from '../../api/contract';
import { executeOpenApi, openApiClient } from '../../api/openapi-client';

export const roomsApi = {
  list: (filters: RoomListFilters): Promise<Paginated<RoomView>> =>
    executeOpenApi(
      openApiClient.GET('/rooms', {
        params: {
          query: {
            page: filters.page,
            limit: filters.limit,
            q: filters.q,
            buildingId: filters.buildingId,
            status: filters.status,
            date: filters.date,
          },
        },
      }),
    ),
  get: (id: string): Promise<RoomView> =>
    executeOpenApi(openApiClient.GET('/rooms/{id}', { params: { path: { id } } })),
  create: (input: CreateRoomInput): Promise<RoomView> =>
    executeOpenApi(openApiClient.POST('/rooms', { body: input })),
  update: (id: string, input: UpdateRoomInput): Promise<RoomView> =>
    executeOpenApi(openApiClient.PATCH('/rooms/{id}', { params: { path: { id } }, body: input })),
};
