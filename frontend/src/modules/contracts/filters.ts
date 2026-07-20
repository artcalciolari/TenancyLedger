import {
  CONTRACT_STATUSES,
  type ContractListFilters,
  type ContractStatus,
} from '../../api/contract';
import type { ContractBadge } from './api';
import { isUuidV4 } from '../../lib/identifiers/uuid';

const allowedLimits = new Set([20, 50, 100]);

export interface ContractPageFilters extends ContractListFilters {
  badge?: ContractBadge;
}

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

function nonEmpty(value: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized === undefined || normalized === '' ? undefined : normalized;
}

function civilDate(value: string | null): string | undefined {
  const normalized = nonEmpty(value);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return undefined;
  const [year, month, day] = normalized.split('-').map(Number);
  const parsed = new Date(Date.UTC(year ?? 0, (month ?? 0) - 1, day ?? 0));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === (month ?? 0) - 1 &&
    parsed.getUTCDate() === day
    ? normalized
    : undefined;
}

export function parseContractFilters(search: URLSearchParams): ContractPageFilters {
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
    tenantId: tenantId && isUuidV4(tenantId) ? tenantId : undefined,
    propertyUnitId: propertyUnitId && isUuidV4(propertyUnitId) ? propertyUnitId : undefined,
    q: nonEmpty(search.get('q')?.slice(0, 120) ?? null),
    moveInFrom: civilDate(search.get('moveInFrom')),
    moveInTo: civilDate(search.get('moveInTo')),
    endFrom: civilDate(search.get('endFrom')),
    endTo: civilDate(search.get('endTo')),
    ...(search.get('badge') === 'RENEWAL_DUE'
      ? { badge: 'RENEWAL_DUE' as const }
      : search.get('badge') === 'PAYMENT_OVERDUE'
        ? { badge: 'PAYMENT_OVERDUE' as const }
        : {}),
    ...(search.get('renewalAttention') === 'true' ? { renewalAttention: true as const } : {}),
  };
}

export function isUuid(value: string): boolean {
  return isUuidV4(value);
}
