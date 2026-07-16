import type {
  BuildingDetailView,
  BuildingListFilters,
  BuildingView,
  CreateBuildingInput,
  Paginated,
  UpdateBuildingInput,
} from '../../api/contract';
import { executeOpenApi, openApiClient } from '../../api/openapi-client';

export const buildingsApi = {
  list: (filters: BuildingListFilters): Promise<Paginated<BuildingView>> =>
    executeOpenApi(
      openApiClient.GET('/buildings', {
        params: { query: { page: filters.page, limit: filters.limit, q: filters.q } },
      }),
    ),
  get: (id: string): Promise<BuildingDetailView> =>
    executeOpenApi(openApiClient.GET('/buildings/{id}', { params: { path: { id } } })),
  create: (input: CreateBuildingInput): Promise<BuildingView> =>
    executeOpenApi(openApiClient.POST('/buildings', { body: input })),
  update: (id: string, input: UpdateBuildingInput): Promise<BuildingDetailView> =>
    executeOpenApi(
      openApiClient.PATCH('/buildings/{id}', { params: { path: { id } }, body: input }),
    ),
};
