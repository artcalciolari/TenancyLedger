import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ValidationError } from '../../core/domain/errors/validation.error';
import { StorageService } from '../../infrastructure/storage.service';
import { Invoice, InvoiceStatus } from './domain/entities/invoice.entity';
import {
  PaymentMethod,
  PaymentIdempotencyConflictError,
  PaymentTransaction,
  ProofType,
} from './domain/entities/payment-transaction.entity';
import { INVOICE_REPOSITORY_TOKEN } from './domain/invoice.repository';
import type { IInvoiceRepository } from './domain/invoice.repository';
import { CLOCK_TOKEN } from './infrastructure/workers/invoice-generation.worker';
import type { Clock } from './infrastructure/workers/invoice-generation.worker';

export interface ListInvoicesInput {
  page: number;
  limit: number;
  contractId?: string;
  competence?: string;
  status?: InvoiceStatus;
}

export interface SubmitPaymentInput {
  idempotencyKey?: string;
  amountCents: number;
  method: PaymentMethod;
  proofType: ProofType | null;
  proof?: {
    originalName: string;
    contentType: string;
    body: Buffer;
  };
}

export interface PaymentView {
  id: string;
  amountCents: number;
  submittedAt: Date;
  method: PaymentMethod;
  proofType: ProofType | null;
  hasProof: boolean;
  status: PaymentTransaction['status'];
  reviewedAt: Date | null;
  rejectionReason: string | null;
}

export interface InvoiceView {
  id: string;
  contractId: string;
  competence: string;
  totalValueCents: number;
  approvedAmountCents: number;
  outstandingAmountCents: number;
  dueDate: string;
  status: InvoiceStatus;
  payments: PaymentView[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedInvoicesView {
  data: InvoiceView[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @Inject(INVOICE_REPOSITORY_TOKEN)
    private readonly repository: IInvoiceRepository,
    @Inject(CLOCK_TOKEN)
    private readonly clock: Clock,
    private readonly storage: StorageService,
  ) {}

  async getById(id: string): Promise<Invoice> {
    const invoice = await this.repository.findById(id);
    if (!invoice) throw new NotFoundException('Fatura não encontrada.');
    invoice.refreshStatus(this.clock.now());
    return invoice;
  }

  async list(input: ListInvoicesInput): Promise<PaginatedInvoicesView> {
    const result = await this.repository.list(input);
    const now = this.clock.now();
    result.items.forEach((invoice) => invoice.refreshStatus(now));
    return {
      data: result.items.map((invoice) => BillingService.toView(invoice)),
      meta: {
        page: input.page,
        limit: input.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / input.limit),
      },
    };
  }

  async submitPayment(invoiceId: string, input: SubmitPaymentInput): Promise<Invoice> {
    PaymentTransaction.assertIdempotencyKey(input.idempotencyKey);
    const idempotencyKey = input.idempotencyKey;
    const requestFingerprint = BillingService.paymentFingerprint(input);
    await this.getById(invoiceId);
    if (input.method === PaymentMethod.CASH && input.proof) {
      throw new ValidationError('Pagamentos em dinheiro não devem enviar comprovante digital.');
    }
    if (input.method !== PaymentMethod.CASH && !input.proof) {
      throw new ValidationError('Pagamentos não realizados em dinheiro exigem um comprovante.');
    }

    let storedKey: string | undefined;

    try {
      const invoice = await this.repository.updateWithLock(
        invoiceId,
        async (current) => {
          const previous = current.findPaymentByIdempotencyKey(idempotencyKey);
          if (previous) {
            if (previous.requestFingerprint !== requestFingerprint) {
              throw new PaymentIdempotencyConflictError(
                'A Idempotency-Key já foi usada nesta fatura com dados diferentes.',
              );
            }
            return;
          }

          if (input.proof) {
            const stored = await this.storage.uploadPaymentProof({
              invoiceId,
              originalName: input.proof.originalName,
              contentType: input.proof.contentType,
              body: input.proof.body,
            });
            storedKey = stored.key;
          }

          current.submitPayment(
            input.amountCents,
            input.method,
            input.proofType,
            storedKey,
            this.clock.now(),
            idempotencyKey,
            requestFingerprint,
          );
        },
        idempotencyKey,
      );
      if (!invoice) throw new NotFoundException('Fatura não encontrada.');
      return invoice;
    } catch (error: unknown) {
      if (storedKey) {
        try {
          await this.storage.deleteObject(storedKey);
        } catch (cleanupError: unknown) {
          this.logger.error(
            'Could not remove an orphaned payment proof',
            cleanupError instanceof Error ? cleanupError.stack : undefined,
          );
        }
      }
      throw error;
    }
  }

  private static paymentFingerprint(input: SubmitPaymentInput): string {
    const proof = input.proof
      ? {
          originalName: input.proof.originalName,
          contentType: input.proof.contentType.toLowerCase(),
          sha256: createHash('sha256').update(input.proof.body).digest('hex'),
        }
      : null;
    return createHash('sha256')
      .update(
        JSON.stringify({
          amountCents: input.amountCents,
          method: input.method,
          proofType: input.proofType,
          proof,
        }),
      )
      .digest('hex');
  }

  async approvePayment(invoiceId: string, paymentId: string): Promise<Invoice> {
    const invoice = await this.repository.updateWithLock(invoiceId, (current) => {
      current.approvePayment(paymentId, this.clock.now());
    });
    if (!invoice) throw new NotFoundException('Fatura não encontrada.');
    return invoice;
  }

  async rejectPayment(invoiceId: string, paymentId: string, reason: string): Promise<Invoice> {
    const invoice = await this.repository.updateWithLock(invoiceId, (current) => {
      current.rejectPayment(paymentId, reason, this.clock.now());
    });
    if (!invoice) throw new NotFoundException('Fatura não encontrada.');
    return invoice;
  }

  async getPaymentProofUrl(
    invoiceId: string,
    paymentId: string,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    const invoice = await this.getById(invoiceId);
    const payment = invoice.transactions.find((candidate) => candidate.id === paymentId);
    if (!payment) throw new NotFoundException('Pagamento não encontrado.');
    if (!payment.proofReference) {
      throw new NotFoundException('Este pagamento não possui comprovante digital.');
    }

    const expiresInSeconds = 300;
    return {
      url: await this.storage.createReadUrl(payment.proofReference, expiresInSeconds),
      expiresInSeconds,
    };
  }

  static toView(invoice: Invoice): InvoiceView {
    return {
      id: invoice.id,
      contractId: invoice.contractId,
      competence: invoice.competence,
      totalValueCents: invoice.totalValueCents,
      approvedAmountCents: invoice.approvedAmountCents,
      outstandingAmountCents: invoice.outstandingAmountCents,
      dueDate: invoice.dueDate,
      status: invoice.status,
      payments: invoice.transactions.map((payment) => BillingService.paymentToView(payment)),
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  }

  private static paymentToView(payment: PaymentTransaction): PaymentView {
    return {
      id: payment.id,
      amountCents: payment.amountCents,
      submittedAt: payment.submittedAt,
      method: payment.method,
      proofType: payment.proofType,
      hasProof: payment.proofReference !== null,
      status: payment.status,
      reviewedAt: payment.reviewedAt,
      rejectionReason: payment.rejectionReason,
    };
  }
}
