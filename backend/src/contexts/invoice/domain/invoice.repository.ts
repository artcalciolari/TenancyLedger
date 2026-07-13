import { Invoice, InvoiceStatus } from './entities/invoice.entity';

export const INVOICE_REPOSITORY_TOKEN = Symbol('INVOICE_REPOSITORY_TOKEN');

export interface InvoiceListOptions {
  page: number;
  limit: number;
  contractId?: string;
  competence?: string;
  status?: InvoiceStatus;
}

export interface InvoiceListResult {
  items: Invoice[];
  total: number;
}

export interface IInvoiceRepository {
  findById(id: string): Promise<Invoice | null>;
  findByContractAndCompetence(contractId: string, competence: string): Promise<Invoice | null>;
  list(options: InvoiceListOptions): Promise<InvoiceListResult>;
  insertIfAbsent(invoice: Invoice): Promise<boolean>;
  updateWithLock(
    id: string,
    update: (invoice: Invoice) => void | Promise<void>,
    transactionKey?: string,
  ): Promise<Invoice | null>;
  markOpenInvoicesOverdue(asOf: string): Promise<number>;
}
