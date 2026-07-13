import type { CreateTenantInput, Paginated, TenantView } from '../../api/contract';
import { executeOpenApi, openApiClient } from '../../api/openapi-client';

export const tenantsApi = {
  list: (page: number, limit: number): Promise<Paginated<TenantView>> =>
    executeOpenApi(openApiClient.GET('/tenants', { params: { query: { page, limit } } })),
  get: (id: string): Promise<TenantView> =>
    executeOpenApi(openApiClient.GET('/tenants/{id}', { params: { path: { id } } })),
  create: (input: CreateTenantInput): Promise<TenantView> =>
    executeOpenApi(openApiClient.POST('/tenants', { body: input })),
};
