import type {
  ContractListFilters,
  ContractView,
  CreateContractInput,
  Paginated,
  RenewContractInput,
} from '../../api/contract';
import { executeOpenApi, openApiClient } from '../../api/openapi-client';

export const contractsApi = {
  list: (filters: ContractListFilters): Promise<Paginated<ContractView>> =>
    executeOpenApi(
      openApiClient.GET('/contracts', {
        params: {
          query: {
            page: filters.page,
            limit: filters.limit,
            status: filters.status,
            tenantId: filters.tenantId,
            propertyUnitId: filters.propertyUnitId,
          },
        },
      }),
    ),
  get: (id: string): Promise<ContractView> =>
    executeOpenApi(openApiClient.GET('/contracts/{id}', { params: { path: { id } } })),
  create: (input: CreateContractInput): Promise<ContractView> =>
    executeOpenApi(openApiClient.POST('/contracts', { body: input })),
  renew: (id: string, input: RenewContractInput): Promise<ContractView> =>
    executeOpenApi(
      openApiClient.PATCH('/contracts/{id}/renew', {
        params: { path: { id } },
        body: input,
      }),
    ),
};
