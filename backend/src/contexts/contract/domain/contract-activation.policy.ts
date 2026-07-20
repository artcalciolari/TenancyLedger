import { Contract, ContractStatus } from './entities/contract.entity';
import { Invoice, InvoiceStatus } from '../../invoice/domain/entities/invoice.entity';

export function isInitialInvoiceForContract(contract: Contract, invoice: Invoice): boolean {
  return invoice.contractId === contract.id && invoice.periodStart === contract.moveInDate;
}

export function canActivateContract(
  contract: Contract,
  initialInvoice: Invoice | null | undefined,
): boolean {
  return (
    contract.status === ContractStatus.PAYMENT_PENDING &&
    !!initialInvoice &&
    isInitialInvoiceForContract(contract, initialInvoice) &&
    initialInvoice.status === InvoiceStatus.PAID
  );
}
