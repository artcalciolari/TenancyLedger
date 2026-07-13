import type { DashboardSummary } from '../../api/contract';
import { executeOpenApi, openApiClient } from '../../api/openapi-client';

export const dashboardApi = {
  summary: (): Promise<DashboardSummary> => executeOpenApi(openApiClient.GET('/dashboard/summary')),
};
