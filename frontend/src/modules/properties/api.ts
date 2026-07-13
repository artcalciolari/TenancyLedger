import type { CreatePropertyInput, Paginated, PropertyView } from '../../api/contract';
import { executeOpenApi, openApiClient } from '../../api/openapi-client';

export const propertiesApi = {
  list: (page: number, limit: number): Promise<Paginated<PropertyView>> =>
    executeOpenApi(openApiClient.GET('/properties', { params: { query: { page, limit } } })),
  get: (id: string): Promise<PropertyView> =>
    executeOpenApi(openApiClient.GET('/properties/{id}', { params: { path: { id } } })),
  create: (input: CreatePropertyInput): Promise<PropertyView> =>
    executeOpenApi(openApiClient.POST('/properties', { body: input })),
};
