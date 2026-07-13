import type { PaymentMethod, ProofType } from '../../api/contract';

export const invoiceStatusLabels = {
  OPEN: 'Em aberto',
  UNDER_REVIEW: 'Em análise',
  PARTIALLY_PAID: 'Parcialmente paga',
  PAID: 'Paga',
  OVERDUE: 'Vencida',
} as const;

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  PIX: 'PIX',
  CASH: 'Dinheiro',
  BANK_TRANSFER: 'Transferência bancária',
};

export const proofTypeLabels: Record<ProofType, string> = {
  DIGITAL_SLIP: 'Comprovante digital',
  SIGNED_RECEIPT: 'Recibo assinado',
  BANK_STATEMENT: 'Extrato bancário',
};
