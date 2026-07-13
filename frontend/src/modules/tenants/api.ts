import type {
  CreateTenantInput,
  Paginated,
  TenantListFilters,
  TenantView,
} from '../../api/contract';
import { executeOpenApi, openApiClient } from '../../api/openapi-client';

export const tenantsApi = {
  list: (filters: TenantListFilters): Promise<Paginated<TenantView>> =>
    executeOpenApi(
      openApiClient.GET('/tenants', {
        params: {
          query: {
            page: filters.page,
            limit: filters.limit,
            q: filters.q,
            civilStatus: filters.civilStatus,
          },
        },
      }),
    ),
  get: (id: string): Promise<TenantView> =>
    executeOpenApi(openApiClient.GET('/tenants/{id}', { params: { path: { id } } })),
  create: (input: CreateTenantInput): Promise<TenantView> =>
    executeOpenApi(openApiClient.POST('/tenants', { body: input })),
};
