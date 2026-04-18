import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Invoice } from './invoice.entity';

export enum PaymentType {
  FULL = 'Full',
  PARTIAL = 'Partial',
}

export enum PaymentMethod {
  PIX = 'Pix',
  CASH = 'Cash',
}

export enum ProofType {
  DIGITAL_SLIP = 'Digital Slip',
  SIGNED_RECEIPT = 'Signed Receipt',
}

@Entity('payment_transactions')
export class PaymentTransaction
{
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @ManyToOne(() => Invoice, invoice => invoice['_transactions'])
  @JoinColumn({ name: 'invoice_id' })
  private _invoice!: Invoice;

  @Column({ type: 'enum', enum: PaymentType })
  private _type!: PaymentType;

  @Column('decimal', { precision: 10, scale: 2 })
  private _amountPaid!: number;

  @Column('timestamp')
  private _paymentDate!: Date;

  @Column({ nullable: true })
  private _proofReference!: string | null;

  @Column({ type: 'enum', enum: PaymentMethod })
  private _method!: PaymentMethod;

  @Column({ type: 'enum', enum: ProofType, nullable: true })
  private _proofType!: ProofType | null;

  private constructor() {}

  // O factory é protegido por escopo se possível, ele só deve ser instanciado e manipulado pelo Aggregate Root (Invoice)
  static create(invoice: Invoice, type: PaymentType, amountPaid: number, method: PaymentMethod, proofType: ProofType, proofReference?: string): PaymentTransaction
  {
    const tx = new PaymentTransaction();
    tx._invoice = invoice;
    tx._type = type;
    tx._amountPaid = amountPaid;
    tx._paymentDate = new Date();
    tx._method = method;
    tx._proofType = proofType;
    tx._proofReference = proofReference ?? null;
    return tx;
  }

  get amountPaid(): number { return this._amountPaid; }
}
