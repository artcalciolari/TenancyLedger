import type {
  InvoiceListFilters,
  InvoiceView,
  Paginated,
  PaymentProofView,
  RejectPaymentInput,
  SubmitPaymentInput,
} from '../../api/contract';
import { executeOpenApi, openApiClient } from '../../api/openapi-client';

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
};
