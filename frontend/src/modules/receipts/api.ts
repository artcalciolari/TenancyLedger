import type { ReceiptDownloadView } from '../../api/contract';
import { executeOpenApi, openApiClient } from '../../api/openapi-client';

export type { ReceiptDownloadView } from '../../api/contract';

export const receiptsApi = {
  download(id: string): Promise<ReceiptDownloadView> {
    return executeOpenApi(
      openApiClient.GET('/receipts/{id}/download', { params: { path: { id } } }),
    );
  },
};
