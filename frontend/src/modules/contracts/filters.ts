import {
  CONTRACT_STATUSES,
  type ContractListFilters,
  type ContractStatus,
} from '../../api/contract';

const allowedLimits = new Set([20, 50, 100]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

export function parseContractFilters(search: URLSearchParams): ContractListFilters {
  const status = search.get('status');
  const limit = positiveInteger(search.get('limit'), 20);
  const tenantId = search.get('tenantId');
  const propertyUnitId = search.get('propertyUnitId');
  return {
    page: positiveInteger(search.get('page'), 1),
    limit: allowedLimits.has(limit) ? limit : 20,
    status: CONTRACT_STATUSES.includes(status as ContractStatus)
      ? (status as ContractStatus)
      : undefined,
    tenantId: tenantId && uuidPattern.test(tenantId) ? tenantId : undefined,
    propertyUnitId: propertyUnitId && uuidPattern.test(propertyUnitId) ? propertyUnitId : undefined,
  };
}

export function isUuid(value: string): boolean {
  return uuidPattern.test(value);
}
