import type {
  ContractDocumentView as ApiContractDocumentView,
  ContractListFilters,
  ContractView,
  CreateContractInput,
  Paginated,
  RenewContractInput,
} from '../../api/contract';
import { executeOpenApi, openApiClient } from '../../api/openapi-client';

export type { ContractBadge } from '../../api/contract';

export type ContractApiFilters = ContractListFilters;

export type ContractLifecycleView = ContractView;

export type ContractDocumentView = ApiContractDocumentView;

export const contractsApi = {
  list: (filters: ContractApiFilters): Promise<Paginated<ContractLifecycleView>> =>
    executeOpenApi(
      openApiClient.GET('/contracts', {
        params: {
          query: {
            page: filters.page,
            limit: filters.limit,
            status: filters.status,
            tenantId: filters.tenantId,
            propertyUnitId: filters.propertyUnitId,
            q: filters.q,
            moveInFrom: filters.moveInFrom,
            moveInTo: filters.moveInTo,
            endFrom: filters.endFrom,
            endTo: filters.endTo,
            badge: filters.badge,
            renewalAttention: filters.renewalAttention,
          },
        },
      }),
    ),
  get: (id: string): Promise<ContractLifecycleView> =>
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
  exportCsv: (filters: ContractListFilters): Promise<string> =>
    executeOpenApi(
      openApiClient.GET('/contracts/export.csv', {
        params: {
          query: {
            status: filters.status,
            tenantId: filters.tenantId,
            propertyUnitId: filters.propertyUnitId,
            q: filters.q,
            moveInFrom: filters.moveInFrom,
            moveInTo: filters.moveInTo,
            endFrom: filters.endFrom,
            endTo: filters.endTo,
            badge: filters.badge,
            renewalAttention: filters.renewalAttention,
          },
        },
      }),
    ),
  previewDocument(id: string): Promise<Blob> {
    return executeOpenApi(
      openApiClient.GET('/contracts/{id}/document/preview', {
        params: { path: { id } },
        parseAs: 'blob',
      }),
    );
  },
  listDocuments(id: string): Promise<ContractDocumentView[]> {
    return executeOpenApi(
      openApiClient.GET('/contracts/{id}/documents', { params: { path: { id } } }),
    );
  },
  generateDocument(id: string): Promise<ContractDocumentView> {
    return executeOpenApi(
      openApiClient.POST('/contracts/{id}/documents/generate', { params: { path: { id } } }),
    );
  },
  uploadSignedDocument(id: string, file: File): Promise<ContractDocumentView> {
    const form = new FormData();
    form.set('kind', 'SIGNED');
    form.set('document', file, file.name);
    return executeOpenApi(
      openApiClient.POST('/contracts/{id}/documents', {
        params: { path: { id } },
        body: { document: file.name, kind: 'SIGNED' },
        bodySerializer: () => form,
      }),
    );
  },
};
