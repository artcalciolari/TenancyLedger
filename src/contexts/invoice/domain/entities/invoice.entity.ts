import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { PaymentTransaction, PaymentType, PaymentMethod, ProofType } from './payment-transaction.entity';

export enum InvoiceStatus {
  PENDING = 'Pending', // DEFAULT;
  UNDER_REVIEW = 'Under-Review', // Status intermediário para quando o comprovante é anexado, mas não validado;
  PARTIALLY_PAID = 'Partially-Paid', // Status para quando há pagamentos parciais, mas o total ainda não foi quitado;
  PAID = 'Paid', // Status para quando o total da fatura foi quitado;
  OVERDUE = 'Overdue', // Status para quando a data de vencimento passou sem que o pagamento total fosse efetuado;
}

@Entity('invoices')
export class Invoice
{
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Column('uuid')
  private _contractId!: string;

  @Column('decimal', { precision: 10, scale: 2 })
  private _totalValue!: number;

  @Column('date')
  private _dueDate!: Date;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.PENDING })
  private _status!: InvoiceStatus;

  @OneToMany(() => PaymentTransaction, tx => tx['_invoice'], { cascade: true, eager: true })
  private _transactions!: PaymentTransaction[];

  private constructor() {}

  static create(contractId: string, totalValue: number, dueDate: Date): Invoice
  {
    const invoice = new Invoice();
    invoice._contractId = contractId;
    invoice._totalValue = totalValue;
    invoice._dueDate = dueDate;
    invoice._status = InvoiceStatus.PENDING;
    invoice._transactions = [];
    return invoice;
  }

  submitPayment(amountPaid: number, method: PaymentMethod, proofType: ProofType, proofReference?: string): void
  {
    if (this._status === InvoiceStatus.PAID)
    {
      throw new Error('Não é possível adicionar pagamentos a uma fatura já quitada.');
    }

    const type = amountPaid >= this._totalValue ? PaymentType.FULL : PaymentType.PARTIAL;
    const tx = PaymentTransaction.create(this, type, amountPaid, method, proofType, proofReference);

    this._transactions.push(tx);
    this._status = InvoiceStatus.UNDER_REVIEW;
  }

  // Getters para a camada de infra...
  get totalValue(): number { return this._totalValue; }
}
