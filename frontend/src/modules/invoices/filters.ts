import {
  INVOICE_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type InvoiceListFilters,
  type InvoiceStatus,
  type PaymentMethod,
  type PaymentStatus,
} from '../../api/contract';
import { isUuidV4 } from '../../lib/identifiers/uuid';

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const allowedLimits = new Set([20, 50, 100]);

function nonEmpty(value: string | null): string | undefined {
  if (value === null || value === '') return undefined;
  return value;
}

function competence(value: string | null): string | undefined {
  const normalized = nonEmpty(value);
  return normalized && /^\d{4}-(0[1-9]|1[0-2])$/.test(normalized) ? normalized : undefined;
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

export function parseInvoiceFilters(search: URLSearchParams): InvoiceListFilters {
  const status = search.get('status');
  const parsedLimit = positiveInt(search.get('limit'), 20);
  const contractId = search.get('contractId')?.trim() ?? '';
  const paymentMethod = search.get('paymentMethod');
  const paymentStatus = search.get('paymentStatus');
  const tenantId = search.get('tenantId')?.trim() ?? '';
  const propertyUnitId = search.get('propertyUnitId')?.trim() ?? '';

  return {
    page: positiveInt(search.get('page'), 1),
    limit: allowedLimits.has(parsedLimit) ? parsedLimit : 20,
    status: INVOICE_STATUSES.includes(status as InvoiceStatus)
      ? (status as InvoiceStatus)
      : undefined,
    competence: competence(search.get('competence')),
    contractId: contractId && isUuidV4(contractId) ? contractId : undefined,
    q: nonEmpty(search.get('q')?.slice(0, 120) ?? null),
    dueFrom: civilDate(search.get('dueFrom')),
    dueTo: civilDate(search.get('dueTo')),
    tenantId: tenantId && isUuidV4(tenantId) ? tenantId : undefined,
    propertyUnitId: propertyUnitId && isUuidV4(propertyUnitId) ? propertyUnitId : undefined,
    paymentMethod: PAYMENT_METHODS.includes(paymentMethod as PaymentMethod)
      ? (paymentMethod as PaymentMethod)
      : undefined,
    paymentStatus: PAYMENT_STATUSES.includes(paymentStatus as PaymentStatus)
      ? (paymentStatus as PaymentStatus)
      : undefined,
  };
}
