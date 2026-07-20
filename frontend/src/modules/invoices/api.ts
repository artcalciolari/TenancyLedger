import type {
  CashSettlementView,
  InvoiceListFilters,
  InvoiceView,
  Paginated,
  PaymentProofView,
  PaymentReviewFilters,
  PaymentReviewItem,
  RejectPaymentInput,
  SubmitPaymentInput,
} from '../../api/contract';
import { executeOpenApi, openApiClient } from '../../api/openapi-client';

export type SettleCashResult = CashSettlementView;

export const invoicesApi = {
  list(filters: InvoiceListFilters): Promise<Paginated<InvoiceView>> {
    return executeOpenApi(
      openApiClient.GET('/invoices', {
        params: {
          query: {
            page: filters.page,
            limit: filters.limit,
            contractId: filters.contractId,
            competence: filters.competence,
            status: filters.status,
            q: filters.q,
            dueFrom: filters.dueFrom,
            dueTo: filters.dueTo,
            tenantId: filters.tenantId,
            propertyUnitId: filters.propertyUnitId,
            paymentMethod: filters.paymentMethod,
            paymentStatus: filters.paymentStatus,
          },
        },
      }),
    );
  },
  review(filters: PaymentReviewFilters): Promise<Paginated<PaymentReviewItem>> {
    return executeOpenApi(
      openApiClient.GET('/payments/review', {
        params: {
          query: {
            page: filters.page,
            limit: filters.limit,
            q: filters.q,
            competence: filters.competence,
            method: filters.method,
            submittedFrom: filters.submittedFrom,
            submittedTo: filters.submittedTo,
            tenantId: filters.tenantId,
            propertyUnitId: filters.propertyUnitId,
          },
        },
      }),
    );
  },
  get(id: string): Promise<InvoiceView> {
    return executeOpenApi(openApiClient.GET('/invoices/{id}', { params: { path: { id } } }));
  },
  submit(id: string, input: SubmitPaymentInput, idempotencyKey: string) {
    const form = new FormData();
    form.set('amountCents', String(input.amountCents));
    form.set('method', input.method);
    if (input.proofType) form.set('proofType', input.proofType);
    if (input.proof) form.set('proof', input.proof, input.proof.name);
    return executeOpenApi(
      openApiClient.POST('/invoices/{id}/payments', {
        params: {
          path: { id },
          header: { 'Idempotency-Key': idempotencyKey },
        },
        body: {
          amountCents: input.amountCents,
          method: input.method,
          proofType: input.proofType,
          proof: input.proof?.name,
        },
        bodySerializer: () => form,
      }),
    );
  },
  approve(invoiceId: string, paymentId: string): Promise<InvoiceView> {
    return executeOpenApi(
      openApiClient.PATCH('/invoices/{invoiceId}/payments/{paymentId}/approve', {
        params: { path: { invoiceId, paymentId } },
      }),
    );
  },
  reject(invoiceId: string, paymentId: string, input: RejectPaymentInput): Promise<InvoiceView> {
    return executeOpenApi(
      openApiClient.PATCH('/invoices/{invoiceId}/payments/{paymentId}/reject', {
        params: { path: { invoiceId, paymentId } },
        body: input,
      }),
    );
  },
  proof(invoiceId: string, paymentId: string): Promise<PaymentProofView> {
    return executeOpenApi(
      openApiClient.GET('/invoices/{invoiceId}/payments/{paymentId}/proof', {
        params: { path: { invoiceId, paymentId } },
      }),
    );
  },
  lookupPayment(id: string, idempotencyKey: string) {
    return executeOpenApi(
      openApiClient.GET('/invoices/{id}/payments/by-idempotency-key', {
        params: { path: { id }, header: { 'Idempotency-Key': idempotencyKey } },
      }),
    );
  },
  settleCash(id: string, amountCents: number, idempotencyKey: string): Promise<SettleCashResult> {
    return executeOpenApi(
      openApiClient.POST('/invoices/{id}/settle-cash', {
        params: { path: { id }, header: { 'Idempotency-Key': idempotencyKey } },
        body: { amountCents },
      }),
    );
  },
  exportCsv(filters: InvoiceListFilters): Promise<string> {
    return executeOpenApi(
      openApiClient.GET('/invoices/export.csv', {
        params: {
          query: {
            contractId: filters.contractId,
            competence: filters.competence,
            status: filters.status,
            q: filters.q,
            dueFrom: filters.dueFrom,
            dueTo: filters.dueTo,
            tenantId: filters.tenantId,
            propertyUnitId: filters.propertyUnitId,
            paymentMethod: filters.paymentMethod,
            paymentStatus: filters.paymentStatus,
          },
        },
      }),
    );
  },
};
