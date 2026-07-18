import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  ForeignKey,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ConflictError } from '../../../../core/domain/errors/conflict.error';
import { ValidationError } from '../../../../core/domain/errors/validation.error';
import { Contract } from '../../../contract/domain/entities/contract.entity';
import {
  PaymentMethod,
  PaymentStatus,
  PaymentTransaction,
  ProofType,
} from './payment-transaction.entity';

export enum InvoiceStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
}

export class InvoiceStateError extends ConflictError {}

@Entity('invoices')
@Unique('UQ_invoices_contract_competence', ['_contractId', '_competence'])
@Check('CHK_invoices_total_positive', 'total_value_cents > 0')
@Check('CHK_invoices_competence_format', "competence ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'")
@Check(
  'CHK_invoices_due_date_competence',
  'EXTRACT(YEAR FROM due_date) = substring(competence from 1 for 4)::integer AND EXTRACT(MONTH FROM due_date) = substring(competence from 6 for 2)::integer',
)
@Index('IDX_invoices_contract_id', ['_contractId'])
export class Invoice {
  static readonly MAX_MONEY_CENTS = 2_147_483_647;

  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Column({ name: 'contract_id', type: 'uuid' })
  @ForeignKey(() => Contract, {
    name: 'FK_invoices_contract',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  private _contractId!: string;

  @Column({ name: 'competence', type: 'char', length: 7 })
  private _competence!: string;

  @Column({ name: 'total_value_cents', type: 'integer' })
  private _totalValueCents!: number;

  @Column({ name: 'due_date', type: 'date' })
  private _dueDate!: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: InvoiceStatus,
    enumName: 'invoice_status',
    default: InvoiceStatus.OPEN,
  })
  private _status!: InvoiceStatus;

  @OneToMany(() => PaymentTransaction, (transaction) => transaction.invoice, {
    cascade: ['insert', 'update'],
    eager: true,
  })
  private _transactions!: PaymentTransaction[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  readonly createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  readonly updatedAt!: Date;

  private constructor() {}

  static create(
    contractId: string,
    competence: string,
    totalValueCents: number,
    dueDate: string,
  ): Invoice {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contractId)
    ) {
      throw new ValidationError('O ID do contrato deve ser um UUID válido.');
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competence)) {
      throw new ValidationError('A competência deve estar no formato AAAA-MM.');
    }
    if (
      !Number.isSafeInteger(totalValueCents) ||
      totalValueCents <= 0 ||
      totalValueCents > Invoice.MAX_MONEY_CENTS
    ) {
      throw new ValidationError(
        'O valor total da fatura em centavos deve ser um inteiro positivo seguro.',
      );
    }
    Invoice.assertDate(dueDate);
    if (!dueDate.startsWith(`${competence}-`)) {
      throw new ValidationError('A data de vencimento deve pertencer à competência da fatura.');
    }

    const invoice = new Invoice();
    invoice._contractId = contractId;
    invoice._competence = competence;
    invoice._totalValueCents = totalValueCents;
    invoice._dueDate = dueDate;
    invoice._status = InvoiceStatus.OPEN;
    invoice._transactions = [];
    return invoice;
  }

  submitPayment(
    amountCents: number,
    method: PaymentMethod,
    proofType: ProofType | null,
    proofReference: string | undefined,
    submittedAt: Date,
    idempotencyKey: string,
    requestFingerprint: string,
    submittedByUserId: string,
    statusAsOf?: string,
  ): PaymentTransaction {
    if (this._status === InvoiceStatus.PAID) {
      throw new InvoiceStateError('Não é possível adicionar pagamentos a uma fatura já quitada.');
    }
    if (
      !Number.isSafeInteger(amountCents) ||
      amountCents <= 0 ||
      amountCents > Invoice.MAX_MONEY_CENTS
    ) {
      throw new ValidationError(
        'O valor do pagamento em centavos deve ser um inteiro positivo seguro.',
      );
    }

    const reservedCents = this._transactions
      .filter((transaction) => transaction.status !== PaymentStatus.REJECTED)
      .reduce((sum, transaction) => sum + transaction.amountCents, 0);
    if (amountCents > this._totalValueCents - reservedCents) {
      throw new InvoiceStateError('O pagamento excede o saldo disponível da fatura.');
    }

    const transaction = PaymentTransaction.create(
      this,
      amountCents,
      method,
      proofType,
      proofReference,
      submittedAt,
      idempotencyKey,
      requestFingerprint,
      submittedByUserId,
    );
    const effectiveStatusAsOf = statusAsOf ?? submittedAt.toISOString().slice(0, 10);
    Invoice.assertDate(effectiveStatusAsOf, 'referência da fatura');
    this._transactions.push(transaction);
    this.recalculateStatus(effectiveStatusAsOf);
    return transaction;
  }

  findPaymentByIdempotencyKey(idempotencyKey: string): PaymentTransaction | undefined {
    return this._transactions.find((transaction) => transaction.idempotencyKey === idempotencyKey);
  }

  approvePayment(
    paymentId: string,
    reviewedAt: Date,
    reviewedByUserId: string,
    statusAsOf = reviewedAt.toISOString().slice(0, 10),
  ): PaymentTransaction {
    const transaction = this.findPayment(paymentId);
    const approvedAfterReview = this.approvedAmountCents + transaction.amountCents;
    if (approvedAfterReview > this._totalValueCents) {
      throw new InvoiceStateError('A aprovação causaria pagamento acima do valor da fatura.');
    }
    transaction.approve(reviewedAt, reviewedByUserId);
    this.recalculateStatus(statusAsOf);
    return transaction;
  }

  rejectPayment(
    paymentId: string,
    reason: string,
    reviewedAt: Date,
    reviewedByUserId: string,
    statusAsOf = reviewedAt.toISOString().slice(0, 10),
  ): PaymentTransaction {
    const transaction = this.findPayment(paymentId);
    transaction.reject(reason, reviewedAt, reviewedByUserId);
    this.recalculateStatus(statusAsOf);
    return transaction;
  }

  refreshStatus(asOf: Date | string): void {
    const civilDate =
      typeof asOf === 'string'
        ? asOf
        : asOf instanceof Date && !Number.isNaN(asOf.getTime())
          ? asOf.toISOString().slice(0, 10)
          : null;
    if (!civilDate) {
      throw new ValidationError('A data de referência da fatura é inválida.');
    }
    Invoice.assertDate(civilDate, 'referência da fatura');
    this.recalculateStatus(civilDate);
  }

  private findPayment(paymentId: string): PaymentTransaction {
    const transaction = this._transactions.find((candidate) => candidate.id === paymentId);
    if (!transaction) {
      throw new ValidationError('O pagamento informado não pertence a esta fatura.');
    }
    return transaction;
  }

  private recalculateStatus(asOf: string): void {
    const approved = this.approvedAmountCents;
    if (approved === this._totalValueCents) {
      this._status = InvoiceStatus.PAID;
      return;
    }
    if (this._transactions.some((transaction) => transaction.status === PaymentStatus.SUBMITTED)) {
      this._status = InvoiceStatus.UNDER_REVIEW;
      return;
    }
    if (approved > 0) {
      this._status = InvoiceStatus.PARTIALLY_PAID;
      return;
    }
    this._status = this._dueDate < asOf ? InvoiceStatus.OVERDUE : InvoiceStatus.OPEN;
  }

  private static assertDate(value: string, field = 'vencimento'): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new ValidationError(`A data de ${field} deve estar no formato AAAA-MM-DD.`);
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(5, 7));
    const day = Number(value.slice(8, 10));
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new ValidationError(`A data de ${field} é inválida.`);
    }
  }

  get contractId(): string {
    return this._contractId;
  }
  get competence(): string {
    return this._competence;
  }
  get totalValueCents(): number {
    return this._totalValueCents;
  }
  get dueDate(): string {
    return this._dueDate;
  }
  get status(): InvoiceStatus {
    return this._status;
  }
  get transactions(): readonly PaymentTransaction[] {
    return this._transactions;
  }
  get approvedAmountCents(): number {
    return this._transactions
      .filter((transaction) => transaction.status === PaymentStatus.APPROVED)
      .reduce((sum, transaction) => sum + transaction.amountCents, 0);
  }
  get outstandingAmountCents(): number {
    return this._totalValueCents - this.approvedAmountCents;
  }
}
