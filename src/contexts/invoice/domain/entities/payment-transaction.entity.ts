import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ConflictError } from '../../../../core/domain/errors/conflict.error';
import { ValidationError } from '../../../../core/domain/errors/validation.error';
import { Invoice } from './invoice.entity';

export enum PaymentStatus {
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum PaymentMethod {
  PIX = 'PIX',
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

export enum ProofType {
  DIGITAL_SLIP = 'DIGITAL_SLIP',
  SIGNED_RECEIPT = 'SIGNED_RECEIPT',
  BANK_STATEMENT = 'BANK_STATEMENT',
}

export class PaymentStateError extends ConflictError {}
export class PaymentIdempotencyConflictError extends ConflictError {}

@Entity('payment_transactions')
@Index('IDX_payment_transactions_invoice_id', ['invoice'])
@Unique('UQ_payment_transactions_invoice_id_idempotency_key', ['invoice', '_idempotencyKey'])
@Check('CHK_payment_transactions_amount_positive', 'amount_cents > 0')
@Check('CHK_payment_transactions_idempotency_key', 'char_length(idempotency_key) BETWEEN 8 AND 128')
@Check('CHK_payment_transactions_request_fingerprint', "request_fingerprint ~ '^[0-9a-f]{64}$'")
@Check(
  'CHK_payment_transactions_proof',
  "method = 'CASH'::payment_method OR (proof_type IS NOT NULL AND proof_reference IS NOT NULL AND char_length(trim(proof_reference)) > 0)",
)
@Check(
  'CHK_payment_transactions_review_state',
  "(status = 'SUBMITTED'::payment_status AND reviewed_at IS NULL AND rejection_reason IS NULL) OR (status = 'APPROVED'::payment_status AND reviewed_at IS NOT NULL AND rejection_reason IS NULL) OR (status = 'REJECTED'::payment_status AND reviewed_at IS NOT NULL AND rejection_reason IS NOT NULL AND char_length(trim(rejection_reason)) > 0)",
)
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.transactions, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'invoice_id' })
  invoice!: Invoice;

  @Column({ name: 'amount_cents', type: 'integer' })
  private _amountCents!: number;

  @Column({ name: 'submitted_at', type: 'timestamptz' })
  private _submittedAt!: Date;

  @Column({ name: 'proof_reference', type: 'varchar', length: 500, nullable: true })
  private _proofReference!: string | null;

  @Column({ name: 'method', type: 'enum', enum: PaymentMethod, enumName: 'payment_method' })
  private _method!: PaymentMethod;

  @Column({
    name: 'proof_type',
    type: 'enum',
    enum: ProofType,
    enumName: 'payment_proof_type',
    nullable: true,
  })
  private _proofType!: ProofType | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: PaymentStatus,
    enumName: 'payment_status',
    default: PaymentStatus.SUBMITTED,
  })
  private _status!: PaymentStatus;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  private _reviewedAt!: Date | null;

  @Column({ name: 'rejection_reason', type: 'varchar', length: 500, nullable: true })
  private _rejectionReason!: string | null;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128 })
  private _idempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  private _requestFingerprint!: string;

  private constructor() {}

  static create(
    invoice: Invoice,
    amountCents: number,
    method: PaymentMethod,
    proofType: ProofType | null,
    proofReference: string | undefined,
    submittedAt: Date,
    idempotencyKey: string,
    requestFingerprint: string,
  ): PaymentTransaction {
    if (
      !Number.isSafeInteger(amountCents) ||
      amountCents <= 0 ||
      amountCents > Invoice.MAX_MONEY_CENTS
    ) {
      throw new ValidationError(
        'O valor do pagamento em centavos deve ser um inteiro positivo seguro.',
      );
    }
    if (!Object.values(PaymentMethod).includes(method)) {
      throw new ValidationError('O método de pagamento é inválido.');
    }
    if (proofType !== null && !Object.values(ProofType).includes(proofType)) {
      throw new ValidationError('O tipo de comprovante é inválido.');
    }
    if (!(submittedAt instanceof Date) || Number.isNaN(submittedAt.getTime())) {
      throw new ValidationError('A data de submissão do pagamento é inválida.');
    }
    PaymentTransaction.assertIdempotencyKey(idempotencyKey);
    if (!/^[0-9a-f]{64}$/.test(requestFingerprint)) {
      throw new ValidationError('A impressão digital da requisição de pagamento é inválida.');
    }

    const normalizedReference = proofReference?.trim() || null;
    if (normalizedReference && normalizedReference.length > 500) {
      throw new ValidationError('A referência do comprovante deve ter no máximo 500 caracteres.');
    }
    if (method !== PaymentMethod.CASH && (!proofType || !normalizedReference)) {
      throw new ValidationError(
        'Pagamentos não realizados em dinheiro exigem tipo e referência de comprovante.',
      );
    }

    const transaction = new PaymentTransaction();
    transaction.invoice = invoice;
    transaction._amountCents = amountCents;
    transaction._submittedAt = new Date(submittedAt);
    transaction._method = method;
    transaction._proofType = proofType;
    transaction._proofReference = normalizedReference;
    transaction._status = PaymentStatus.SUBMITTED;
    transaction._reviewedAt = null;
    transaction._rejectionReason = null;
    transaction._idempotencyKey = idempotencyKey;
    transaction._requestFingerprint = requestFingerprint;
    return transaction;
  }

  static assertIdempotencyKey(value: string | undefined): asserts value is string {
    if (!value || !/^[\x21-\x7e]{8,128}$/.test(value)) {
      throw new ValidationError(
        'O header Idempotency-Key deve conter de 8 a 128 caracteres ASCII visíveis.',
      );
    }
  }

  approve(reviewedAt: Date): void {
    this.assertCanReview(reviewedAt);
    this._status = PaymentStatus.APPROVED;
    this._reviewedAt = new Date(reviewedAt);
    this._rejectionReason = null;
  }

  reject(reason: string, reviewedAt: Date): void {
    this.assertCanReview(reviewedAt);
    const normalizedReason = reason?.trim();
    if (!normalizedReason || normalizedReason.length > 500) {
      throw new ValidationError('O motivo da rejeição deve conter entre 1 e 500 caracteres.');
    }
    this._status = PaymentStatus.REJECTED;
    this._reviewedAt = new Date(reviewedAt);
    this._rejectionReason = normalizedReason;
  }

  private assertCanReview(reviewedAt: Date): void {
    if (this._status !== PaymentStatus.SUBMITTED) {
      throw new PaymentStateError('Somente um pagamento submetido pode ser revisado.');
    }
    if (
      !(reviewedAt instanceof Date) ||
      Number.isNaN(reviewedAt.getTime()) ||
      reviewedAt < this._submittedAt
    ) {
      throw new ValidationError('A data de revisão do pagamento é inválida.');
    }
  }

  get amountCents(): number {
    return this._amountCents;
  }
  get submittedAt(): Date {
    return new Date(this._submittedAt);
  }
  get proofReference(): string | null {
    return this._proofReference;
  }
  get method(): PaymentMethod {
    return this._method;
  }
  get proofType(): ProofType | null {
    return this._proofType;
  }
  get status(): PaymentStatus {
    return this._status;
  }
  get reviewedAt(): Date | null {
    return this._reviewedAt ? new Date(this._reviewedAt) : null;
  }
  get rejectionReason(): string | null {
    return this._rejectionReason;
  }
  get idempotencyKey(): string {
    return this._idempotencyKey;
  }
  get requestFingerprint(): string {
    return this._requestFingerprint;
  }
}
