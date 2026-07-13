import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { PaymentMethod, PaymentStatus, ProofType } from './entities/payment-transaction.entity';
import { TenantCivilStatus } from '../../tenant/domain/entities/tenant.entity';
import { UnitType } from '../../property/domain/property-unit.entity';

export const INVOICE_REPOSITORY_TOKEN = Symbol('INVOICE_REPOSITORY_TOKEN');

export interface InvoiceFilterOptions {
  contractId?: string;
  competence?: string;
  status?: InvoiceStatus;
  tenantId?: string;
  propertyUnitId?: string;
  dueFrom?: string;
  dueTo?: string;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  q?: string;
}

export interface InvoiceListOptions extends InvoiceFilterOptions {
  page: number;
  limit: number;
}

export interface PaymentReviewListOptions {
  page: number;
  limit: number;
  method?: PaymentMethod;
  competence?: string;
  tenantId?: string;
  propertyUnitId?: string;
  submittedFrom?: string;
  submittedTo?: string;
  q?: string;
}

export interface PaymentReviewRecord {
  paymentId: string;
  amountCents: number;
  submittedAt: Date;
  method: PaymentMethod;
  proofType: ProofType | null;
  hasProof: boolean;
  status: PaymentStatus;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  submittedByUserId: string | null;
  reviewedByUserId: string | null;
  invoiceId: string;
  competence: string;
  dueDate: string;
  invoiceStatus: InvoiceStatus;
  totalValueCents: number;
  approvedAmountCents: number;
  outstandingAmountCents: number;
  contractId: string;
  contractStatus: import('../../contract/domain/entities/contract.entity').ContractStatus;
  contractEndDate: string;
  tenantId: string;
  tenantCpf: string;
  tenantProfession: string;
  tenantCivilStatus: TenantCivilStatus;
  tenantEmail: string;
  tenantMobilePhone: string;
  propertyUnitId: string;
  propertyNeighborhood: string;
  propertyType: UnitType;
  propertyUnitNumber: string;
}

export interface PaymentReviewListResult {
  items: PaymentReviewRecord[];
  total: number;
}

export interface InvoiceListResult {
  items: Invoice[];
  total: number;
}

export interface IInvoiceRepository {
  findById(id: string): Promise<Invoice | null>;
  findByContractAndCompetence(contractId: string, competence: string): Promise<Invoice | null>;
  list(options: InvoiceListOptions): Promise<InvoiceListResult>;
  listForExport(options: InvoiceFilterOptions): Promise<Invoice[]>;
  listPaymentsForReview(options: PaymentReviewListOptions): Promise<PaymentReviewListResult>;
  insertIfAbsent(invoice: Invoice): Promise<boolean>;
  updateWithLock(
    id: string,
    update: (invoice: Invoice) => void | Promise<void>,
    transactionKey?: string,
  ): Promise<Invoice | null>;
  markOpenInvoicesOverdue(asOf: string): Promise<number>;
}
