import {
  Check,
  Column,
  Entity,
  ForeignKey,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ConflictError } from '../../../../core/domain/errors/conflict.error';
import { ValidationError } from '../../../../core/domain/errors/validation.error';
import { Invoice } from './invoice.entity';
import { User } from '../../../auth/domain/entities/user.entity';

export enum PaymentStatus {
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REVERSED = 'REVERSED',
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
  "(status::text = 'SUBMITTED' AND reviewed_at IS NULL AND rejection_reason IS NULL AND reversed_at IS NULL AND reversal_reason IS NULL AND reversed_by_user_id IS NULL) OR (status::text = 'APPROVED' AND reviewed_at IS NOT NULL AND rejection_reason IS NULL AND reversed_at IS NULL AND reversal_reason IS NULL AND reversed_by_user_id IS NULL) OR (status::text = 'REJECTED' AND reviewed_at IS NOT NULL AND rejection_reason IS NOT NULL AND char_length(trim(rejection_reason)) > 0 AND reversed_at IS NULL AND reversal_reason IS NULL AND reversed_by_user_id IS NULL) OR (status::text = 'REVERSED' AND reviewed_at IS NOT NULL AND rejection_reason IS NULL AND reversed_at IS NOT NULL AND reversal_reason IS NOT NULL AND char_length(trim(reversal_reason)) > 0 AND reversed_by_user_id IS NOT NULL)",
)
@Check(
  'CHK_payment_transactions_direct_settlement',
  "NOT is_direct_settlement OR (method::text = 'CASH' AND status::text IN ('APPROVED', 'REVERSED') AND submitted_by_user_id IS NOT NULL AND reviewed_by_user_id = submitted_by_user_id)",
)
@Check(
  'CHK_payment_transactions_distinct_actors',
  'reviewed_by_user_id IS NULL OR submitted_by_user_id IS NULL OR reviewed_by_user_id <> submitted_by_user_id OR is_direct_settlement',
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

  @Column({ name: 'is_direct_settlement', type: 'boolean', default: false })
  private _isDirectSettlement!: boolean;

  @Column({ name: 'reversal_reason', type: 'varchar', length: 500, nullable: true })
  private _reversalReason!: string | null;

  @Column({ name: 'reversed_at', type: 'timestamptz', nullable: true })
  private _reversedAt!: Date | null;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128 })
  private _idempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  private _requestFingerprint!: string;

  @Column({ name: 'submitted_by_user_id', type: 'uuid', nullable: true })
  @ForeignKey(() => User, {
    name: 'FK_payment_transactions_submitted_by_user',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  private _submittedByUserId!: string | null;

  @Column({ name: 'reviewed_by_user_id', type: 'uuid', nullable: true })
  @ForeignKey(() => User, {
    name: 'FK_payment_transactions_reviewed_by_user',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  private _reviewedByUserId!: string | null;

  @Column({ name: 'reversed_by_user_id', type: 'uuid', nullable: true })
  @ForeignKey(() => User, {
    name: 'FK_payment_transactions_reversed_by_user',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  private _reversedByUserId!: string | null;

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
    submittedByUserId: string,
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
    PaymentTransaction.assertUserId(submittedByUserId, 'submissão');

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
    transaction._isDirectSettlement = false;
    transaction._reversalReason = null;
    transaction._reversedAt = null;
    transaction._idempotencyKey = idempotencyKey;
    transaction._requestFingerprint = requestFingerprint;
    transaction._submittedByUserId = submittedByUserId;
    transaction._reviewedByUserId = null;
    transaction._reversedByUserId = null;
    return transaction;
  }

  static createDirectSettlement(
    invoice: Invoice,
    amountCents: number,
    method: PaymentMethod,
    settledAt: Date,
    idempotencyKey: string,
    requestFingerprint: string,
    settledByUserId: string,
  ): PaymentTransaction {
    if (method !== PaymentMethod.CASH) {
      throw new ValidationError('A liquidação direta só pode ser realizada em dinheiro.');
    }
    const transaction = PaymentTransaction.create(
      invoice,
      amountCents,
      method,
      null,
      undefined,
      settledAt,
      idempotencyKey,
      requestFingerprint,
      settledByUserId,
    );
    transaction._status = PaymentStatus.APPROVED;
    transaction._reviewedAt = new Date(settledAt);
    transaction._reviewedByUserId = settledByUserId;
    transaction._isDirectSettlement = true;
    return transaction;
  }

  static assertIdempotencyKey(value: string | undefined): asserts value is string {
    if (!value || !/^[\x21-\x7e]{8,128}$/.test(value)) {
      throw new ValidationError(
        'O header Idempotency-Key deve conter de 8 a 128 caracteres ASCII visíveis.',
      );
    }
  }

  approve(reviewedAt: Date, reviewedByUserId: string): void {
    this.assertCanReview(reviewedAt, reviewedByUserId);
    this._status = PaymentStatus.APPROVED;
    this._reviewedAt = new Date(reviewedAt);
    this._reviewedByUserId = reviewedByUserId;
    this._rejectionReason = null;
  }

  reject(reason: string, reviewedAt: Date, reviewedByUserId: string): void {
    this.assertCanReview(reviewedAt, reviewedByUserId);
    const normalizedReason = reason?.trim();
    if (!normalizedReason || normalizedReason.length > 500) {
      throw new ValidationError('O motivo da rejeição deve conter entre 1 e 500 caracteres.');
    }
    this._status = PaymentStatus.REJECTED;
    this._reviewedAt = new Date(reviewedAt);
    this._reviewedByUserId = reviewedByUserId;
    this._rejectionReason = normalizedReason;
  }

  reverse(reason: string, reversedAt: Date, reversedByUserId: string): void {
    if (this._status !== PaymentStatus.APPROVED) {
      throw new PaymentStateError('Somente um pagamento aprovado pode ser estornado.');
    }
    const normalizedReason = reason?.trim();
    if (!normalizedReason || normalizedReason.length > 500) {
      throw new ValidationError('O motivo do estorno deve conter entre 1 e 500 caracteres.');
    }
    if (
      !(reversedAt instanceof Date) ||
      Number.isNaN(reversedAt.getTime()) ||
      !this._reviewedAt ||
      reversedAt < this._reviewedAt
    ) {
      throw new ValidationError('A data do estorno é inválida.');
    }
    PaymentTransaction.assertUserId(reversedByUserId, 'estorno');
    this._status = PaymentStatus.REVERSED;
    this._reversalReason = normalizedReason;
    this._reversedAt = new Date(reversedAt);
    this._reversedByUserId = reversedByUserId;
  }

  private assertCanReview(reviewedAt: Date, reviewedByUserId: string): void {
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
    PaymentTransaction.assertUserId(reviewedByUserId, 'revisão');
    if (this._submittedByUserId === reviewedByUserId) {
      throw new PaymentStateError('O autor da submissão não pode revisar o próprio pagamento.');
    }
  }

  private static assertUserId(value: string, action: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new ValidationError(`O usuário de ${action} deve ser um UUID válido.`);
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
  get isDirectSettlement(): boolean {
    return this._isDirectSettlement;
  }
  get reversalReason(): string | null {
    return this._reversalReason;
  }
  get reversedAt(): Date | null {
    return this._reversedAt ? new Date(this._reversedAt) : null;
  }
  get idempotencyKey(): string {
    return this._idempotencyKey;
  }
  get requestFingerprint(): string {
    return this._requestFingerprint;
  }
  get submittedByUserId(): string | null {
    return this._submittedByUserId;
  }
  get reviewedByUserId(): string | null {
    return this._reviewedByUserId;
  }
  get reversedByUserId(): string | null {
    return this._reversedByUserId;
  }
}
