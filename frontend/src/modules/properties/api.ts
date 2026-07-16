import type {
  CreatePropertyInput,
  Paginated,
  PropertyListFilters,
  PropertyView,
  UpdatePropertyInput,
} from '../../api/contract';
import { executeOpenApi, openApiClient } from '../../api/openapi-client';

export const propertiesApi = {
  list: (filters: PropertyListFilters): Promise<Paginated<PropertyView>> =>
    executeOpenApi(
      openApiClient.GET('/properties', {
        params: {
          query: { page: filters.page, limit: filters.limit, q: filters.q, type: filters.type },
        },
      }),
    ),
  get: (id: string): Promise<PropertyView> =>
    executeOpenApi(openApiClient.GET('/properties/{id}', { params: { path: { id } } })),
  create: (input: CreatePropertyInput): Promise<PropertyView> =>
    executeOpenApi(openApiClient.POST('/properties', { body: input })),
  update: (id: string, input: UpdatePropertyInput): Promise<PropertyView> =>
    executeOpenApi(
      openApiClient.PATCH('/properties/{id}', { params: { path: { id } }, body: input }),
    ),
};
