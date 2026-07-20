import { executeOpenApi, openApiClient } from '../../api/openapi-client';
import { ApiError } from '../../api/problem';
import type { CashClosingFilters, CashClosingView } from './types';

export const cashboxApi = {
  list(filters: CashClosingFilters = {}): Promise<CashClosingView[]> {
    return executeOpenApi(openApiClient.GET('/cash-closings', { params: { query: filters } }));
  },

  async get(date: string): Promise<CashClosingView | null> {
    try {
      return await executeOpenApi(
        openApiClient.GET('/cash-closings/{date}', { params: { path: { date } } }),
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  close(date: string, countedCashCents: number): Promise<CashClosingView> {
    return executeOpenApi(
      openApiClient.POST('/cash-closings/{date}', {
        params: { path: { date } },
        body: { countedCashCents },
      }),
    );
  },

  reopen(date: string, reason: string): Promise<CashClosingView> {
    return executeOpenApi(
      openApiClient.POST('/cash-closings/{date}/reopen', {
        params: { path: { date } },
        body: { reason },
      }),
    );
  },
};
