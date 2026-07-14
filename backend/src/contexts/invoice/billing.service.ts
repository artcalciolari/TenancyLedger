import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
import type { PaymentReviewListOptions } from './domain/invoice.repository';
import { CLOCK_TOKEN } from './infrastructure/workers/invoice-generation.worker';
import type { Clock } from './infrastructure/workers/invoice-generation.worker';
import { Contract, ContractStatus } from '../contract/domain/entities/contract.entity';
import { Tenant } from '../tenant/domain/entities/tenant.entity';
import { PropertyUnit } from '../property/domain/property-unit.entity';
import { TenantResponseDto } from '../tenant/infrastructure/http/dtos/tenant-response.dto';
import { civilDateInTimeZone } from '../../core/domain/civil-date';

export interface ListInvoicesInput {
  page: number;
  limit: number;
  contractId?: string;
  competence?: string;
  status?: InvoiceStatus;
  tenantId?: string;
  propertyUnitId?: string;
  dueFrom?: string;
  dueTo?: string;
  paymentStatus?: PaymentTransaction['status'];
  paymentMethod?: PaymentMethod;
  q?: string;
}

export interface SubmitPaymentInput {
  idempotencyKey?: string;
  amountCents: number;
  method: PaymentMethod;
  proofType: ProofType | null;
  submittedByUserId: string;
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
  submittedByUserId: string | null;
  reviewedByUserId: string | null;
}

export interface InvoiceContractSummary {
  id: string;
  tenantId: string;
  propertyUnitId: string;
  status: ContractStatus;
  tenant: ReturnType<typeof TenantResponseDto.from>;
  propertyUnit: {
    id: string;
    neighborhood: string;
    type: PropertyUnit['type'];
    unitNumber: string;
  };
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
  contract?: InvoiceContractSummary;
}

export interface DetailedInvoiceView extends InvoiceView {
  contract: InvoiceContractSummary;
}

export interface PaymentReviewView {
  payment: PaymentView;
  invoice: {
    id: string;
    competence: string;
    dueDate: string;
    status: InvoiceStatus;
    totalValueCents: number;
    approvedAmountCents: number;
    outstandingAmountCents: number;
  };
  contract: InvoiceContractSummary;
}

export interface PaginatedPaymentReviewView {
  data: PaymentReviewView[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface PaginatedInvoicesView {
  data: DetailedInvoiceView[];
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
    @Optional()
    @InjectRepository(Contract)
    private readonly contracts?: Repository<Contract>,
    @Optional()
    @InjectRepository(Tenant)
    private readonly tenants?: Repository<Tenant>,
    @Optional()
    @InjectRepository(PropertyUnit)
    private readonly properties?: Repository<PropertyUnit>,
  ) {}

  async getById(id: string): Promise<Invoice> {
    await this.repository.markOpenInvoicesOverdue(this.currentCivilDate());
    const invoice = await this.repository.findById(id);
    if (!invoice) throw new NotFoundException('Fatura não encontrada.');
    invoice.refreshStatus(this.currentCivilDate());
    return invoice;
  }

  async getPaymentByIdempotencyKey(
    invoiceId: string,
    idempotencyKey: string | undefined,
    actorId: string,
    isAdmin: boolean,
  ): Promise<{ invoice: Invoice; payment: PaymentTransaction }> {
    PaymentTransaction.assertIdempotencyKey(idempotencyKey);
    const invoice = await this.getById(invoiceId);
    const payment = invoice.findPaymentByIdempotencyKey(idempotencyKey);
    if (!payment) throw new NotFoundException('Pagamento não encontrado para a chave informada.');
    if (!isAdmin && payment.submittedByUserId !== actorId) {
      throw new ForbiddenException('A chave de idempotência pertence a outro usuário.');
    }
    return { invoice, payment };
  }

  async list(input: ListInvoicesInput): Promise<PaginatedInvoicesView> {
    await this.repository.markOpenInvoicesOverdue(this.currentCivilDate());
    const result = await this.repository.list(input);
    const asOf = this.currentCivilDate();
    result.items.forEach((invoice) => invoice.refreshStatus(asOf));
    const contexts = await this.loadContractSummaries(result.items);
    return {
      data: result.items.map((invoice) =>
        this.detailedInvoiceView(invoice, contexts.get(invoice.contractId)),
      ),
      meta: {
        page: input.page,
        limit: input.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / input.limit),
      },
    };
  }

  async toDetailedView(invoice: Invoice): Promise<DetailedInvoiceView> {
    const contexts = await this.loadContractSummaries([invoice]);
    return this.detailedInvoiceView(invoice, contexts.get(invoice.contractId));
  }

  async listPaymentsForReview(
    input: PaymentReviewListOptions,
  ): Promise<PaginatedPaymentReviewView> {
    await this.repository.markOpenInvoicesOverdue(this.currentCivilDate());
    const result = await this.repository.listPaymentsForReview(input);
    return {
      data: result.items.map((item) => {
        const tenant = TenantResponseDto.from({
          id: item.tenantId,
          name: item.tenantName,
          cpf: item.tenantCpf,
          profession: item.tenantProfession,
          civilStatus: item.tenantCivilStatus,
          email: item.tenantEmail,
          mobilePhone: item.tenantMobilePhone,
        });
        return {
          payment: {
            id: item.paymentId,
            amountCents: Number(item.amountCents),
            submittedAt: item.submittedAt,
            method: item.method,
            proofType: item.proofType,
            hasProof: item.hasProof,
            status: item.status,
            reviewedAt: item.reviewedAt,
            rejectionReason: item.rejectionReason,
            submittedByUserId: item.submittedByUserId,
            reviewedByUserId: item.reviewedByUserId,
          },
          invoice: {
            id: item.invoiceId,
            competence: item.competence,
            dueDate: item.dueDate,
            status: item.invoiceStatus,
            totalValueCents: Number(item.totalValueCents),
            approvedAmountCents: Number(item.approvedAmountCents),
            outstandingAmountCents: Number(item.outstandingAmountCents),
          },
          contract: {
            id: item.contractId,
            tenantId: item.tenantId,
            propertyUnitId: item.propertyUnitId,
            status: this.effectiveContractStatus(item.contractStatus, item.contractEndDate),
            tenant,
            propertyUnit: {
              id: item.propertyUnitId,
              neighborhood: item.propertyNeighborhood,
              type: item.propertyType,
              unitNumber: item.propertyUnitNumber,
            },
          },
        };
      }),
      meta: {
        page: input.page,
        limit: input.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / input.limit),
      },
    };
  }

  async exportCsv(input: ListInvoicesInput): Promise<string> {
    await this.repository.markOpenInvoicesOverdue(this.currentCivilDate());
    const invoices = await this.repository.listForExport(input);
    const contexts = await this.loadContractSummaries(invoices);
    const header = [
      'id',
      'competence',
      'dueDate',
      'status',
      'totalValueCents',
      'approvedAmountCents',
      'outstandingAmountCents',
      'contractId',
      'tenantId',
      'tenantName',
      'tenantCpf',
      'propertyUnitId',
      'propertyNeighborhood',
      'propertyUnitNumber',
    ];
    const rows = invoices.map((invoice) => {
      invoice.refreshStatus(this.currentCivilDate());
      const context = contexts.get(invoice.contractId);
      return [
        invoice.id,
        invoice.competence,
        invoice.dueDate,
        invoice.status,
        invoice.totalValueCents,
        invoice.approvedAmountCents,
        invoice.outstandingAmountCents,
        invoice.contractId,
        context?.tenantId ?? '',
        context?.tenant.name ?? '',
        context?.tenant.cpf ?? '',
        context?.propertyUnitId ?? '',
        context?.propertyUnit.neighborhood ?? '',
        context?.propertyUnit.unitNumber ?? '',
      ];
    });
    return [header, ...rows]
      .map((row) => row.map((value) => BillingService.csvCell(value)).join(','))
      .join('\r\n');
  }

  async submitPayment(invoiceId: string, input: SubmitPaymentInput): Promise<Invoice> {
    PaymentTransaction.assertIdempotencyKey(input.idempotencyKey);
    const idempotencyKey = input.idempotencyKey;
    const requestFingerprint = BillingService.paymentFingerprint(input);
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
            input.submittedByUserId,
            this.currentCivilDate(),
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

  async approvePayment(
    invoiceId: string,
    paymentId: string,
    reviewedByUserId: string,
  ): Promise<Invoice> {
    const invoice = await this.repository.updateWithLock(invoiceId, (current) => {
      current.approvePayment(
        paymentId,
        this.clock.now(),
        reviewedByUserId,
        this.currentCivilDate(),
      );
    });
    if (!invoice) throw new NotFoundException('Fatura não encontrada.');
    return invoice;
  }

  async rejectPayment(
    invoiceId: string,
    paymentId: string,
    reason: string,
    reviewedByUserId: string,
  ): Promise<Invoice> {
    const invoice = await this.repository.updateWithLock(invoiceId, (current) => {
      current.rejectPayment(
        paymentId,
        reason,
        this.clock.now(),
        reviewedByUserId,
        this.currentCivilDate(),
      );
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

  static toView(invoice: Invoice, contract?: InvoiceContractSummary): InvoiceView {
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
      ...(contract ? { contract } : {}),
    };
  }

  static paymentToView(payment: PaymentTransaction): PaymentView {
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
      submittedByUserId: payment.submittedByUserId,
      reviewedByUserId: payment.reviewedByUserId,
    };
  }

  private async loadContractSummaries(
    invoices: readonly Invoice[],
  ): Promise<Map<string, InvoiceContractSummary>> {
    if (!this.contracts || !this.tenants || !this.properties || invoices.length === 0) {
      return new Map();
    }
    const contractIds = [...new Set(invoices.map((invoice) => invoice.contractId))];
    const contracts = await this.contracts.findBy({ id: In(contractIds) });
    const tenantIds = [...new Set(contracts.map((contract) => contract.tenantId))];
    const propertyIds = [...new Set(contracts.map((contract) => contract.propertyUnitId))];
    const [tenants, properties] = await Promise.all([
      tenantIds.length ? this.tenants.findBy({ id: In(tenantIds) }) : [],
      propertyIds.length ? this.properties.findBy({ id: In(propertyIds) }) : [],
    ]);
    const tenantsById = new Map(
      tenants.map((tenant) => [tenant.id, TenantResponseDto.from(tenant)]),
    );
    const propertiesById = new Map(properties.map((property) => [property.id, property]));
    const result = new Map<string, InvoiceContractSummary>();
    for (const contract of contracts) {
      const tenant = tenantsById.get(contract.tenantId);
      const property = propertiesById.get(contract.propertyUnitId);
      if (!tenant || !property) continue;
      result.set(contract.id, {
        id: contract.id,
        tenantId: contract.tenantId,
        propertyUnitId: contract.propertyUnitId,
        status: this.effectiveContractStatus(contract.status, contract.endDate),
        tenant,
        propertyUnit: {
          id: property.id,
          neighborhood: property.neighborhood,
          type: property.type,
          unitNumber: property.unitNumber,
        },
      });
    }
    return result;
  }

  private detailedInvoiceView(
    invoice: Invoice,
    contract: InvoiceContractSummary | undefined,
  ): DetailedInvoiceView {
    if (!contract) throw new NotFoundException('Relacionamentos da fatura não encontrados.');
    return BillingService.toView(invoice, contract) as DetailedInvoiceView;
  }

  private effectiveContractStatus(status: ContractStatus, endDate: string): ContractStatus {
    return status !== ContractStatus.TERMINATED && endDate < this.currentCivilDate()
      ? ContractStatus.EXPIRED
      : status;
  }

  private currentCivilDate(): string {
    return civilDateInTimeZone(this.clock.now());
  }

  private static csvCell(value: string | number | boolean | null | undefined): string {
    const raw = String(value ?? '');
    const text = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
}
