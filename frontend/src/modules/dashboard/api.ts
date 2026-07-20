import type { DashboardSummary } from '../../api/contract';
import { executeOpenApi, openApiClient } from '../../api/openapi-client';

export type FinancialDashboardSummary = DashboardSummary;

export const dashboardApi = {
  summary: (): Promise<FinancialDashboardSummary> =>
    executeOpenApi(openApiClient.GET('/dashboard/summary')),
};
