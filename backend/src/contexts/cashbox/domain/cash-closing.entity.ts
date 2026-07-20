import { Check, Column, Entity, ForeignKey, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ConflictError } from '../../../core/domain/errors/conflict.error';
import { ValidationError } from '../../../core/domain/errors/validation.error';
import { assertCivilDate } from '../../../core/domain/calendar-period';
import { User } from '../../auth/domain/entities/user.entity';

export enum CashClosingStatus {
  CLOSED = 'CLOSED',
  REOPENED = 'REOPENED',
}

export class CashClosingStateError extends ConflictError {}

@Entity('cash_closings')
@Index('UQ_cash_closings_closing_date', ['closingDate'], { unique: true })
@Check('CHK_cash_closings_amounts', 'expected_cash_cents >= 0 AND counted_cash_cents >= 0')
@Check(
  'CHK_cash_closings_reopening',
  `(status = 'CLOSED') OR
   (status = 'REOPENED' AND reopen_reason IS NOT NULL AND reopened_by IS NOT NULL AND reopened_at IS NOT NULL)`,
)
export class CashClosing {
  static readonly MAX_MONEY_CENTS = 2_147_483_647;

  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Column({ name: 'closing_date', type: 'date' })
  closingDate!: string;

  @Column({ name: 'expected_cash_cents', type: 'integer' })
  expectedCashCents!: number;

  @Column({ name: 'counted_cash_cents', type: 'integer' })
  countedCashCents!: number;

  @Column({
    name: 'difference_cents',
    type: 'integer',
    asExpression: 'counted_cash_cents - expected_cash_cents',
    generatedType: 'STORED',
    insert: false,
    update: false,
  })
  readonly differenceCents!: number;

  @Column({
    type: 'enum',
    enum: CashClosingStatus,
    enumName: 'cash_closing_status',
    default: CashClosingStatus.CLOSED,
  })
  status!: CashClosingStatus;

  @Column({ name: 'closed_by', type: 'uuid' })
  @ForeignKey(() => User, {
    name: 'FK_cash_closings_closed_by',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  closedBy!: string;

  @Column({ name: 'closed_at', type: 'timestamptz' })
  closedAt!: Date;

  @Column({ name: 'reopen_reason', type: 'varchar', length: 500, nullable: true })
  reopenReason!: string | null;

  @Column({ name: 'reopened_by', type: 'uuid', nullable: true })
  @ForeignKey(() => User, {
    name: 'FK_cash_closings_reopened_by',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  reopenedBy!: string | null;

  @Column({ name: 'reopened_at', type: 'timestamptz', nullable: true })
  reopenedAt!: Date | null;

  private constructor() {}

  static create(
    closingDate: string,
    expectedCashCents: number,
    countedCashCents: number,
    closedBy: string,
    closedAt: Date,
  ): CashClosing {
    CashClosing.assertDate(closingDate);
    CashClosing.assertAmount(expectedCashCents, 'esperado');
    CashClosing.assertAmount(countedCashCents, 'contado');
    CashClosing.assertUuid(closedBy);
    CashClosing.assertInstant(closedAt);

    const closing = new CashClosing();
    closing.closingDate = closingDate;
    closing.expectedCashCents = expectedCashCents;
    closing.countedCashCents = countedCashCents;
    closing.status = CashClosingStatus.CLOSED;
    closing.closedBy = closedBy;
    closing.closedAt = new Date(closedAt);
    closing.reopenReason = null;
    closing.reopenedBy = null;
    closing.reopenedAt = null;
    return closing;
  }

  reopen(reason: string, reopenedBy: string, reopenedAt: Date): void {
    if (this.status !== CashClosingStatus.CLOSED) {
      throw new CashClosingStateError('O caixa deste dia já está reaberto.');
    }
    const normalizedReason = reason?.trim().replace(/\s+/g, ' ');
    if (!normalizedReason || normalizedReason.length > 500) {
      throw new ValidationError('O motivo da reabertura deve ter entre 1 e 500 caracteres.');
    }
    CashClosing.assertUuid(reopenedBy);
    CashClosing.assertInstant(reopenedAt);
    if (reopenedAt < this.closedAt) {
      throw new ValidationError('A reabertura não pode ocorrer antes do fechamento.');
    }
    this.status = CashClosingStatus.REOPENED;
    this.reopenReason = normalizedReason;
    this.reopenedBy = reopenedBy;
    this.reopenedAt = new Date(reopenedAt);
  }

  closeAgain(
    expectedCashCents: number,
    countedCashCents: number,
    closedBy: string,
    closedAt: Date,
  ): void {
    if (this.status !== CashClosingStatus.REOPENED) {
      throw new CashClosingStateError('O caixa deste dia já está fechado.');
    }
    CashClosing.assertAmount(expectedCashCents, 'esperado');
    CashClosing.assertAmount(countedCashCents, 'contado');
    CashClosing.assertUuid(closedBy);
    CashClosing.assertInstant(closedAt);
    if (this.reopenedAt && closedAt < this.reopenedAt) {
      throw new ValidationError('O novo fechamento não pode ocorrer antes da reabertura.');
    }
    this.expectedCashCents = expectedCashCents;
    this.countedCashCents = countedCashCents;
    this.closedBy = closedBy;
    this.closedAt = new Date(closedAt);
    this.status = CashClosingStatus.CLOSED;
  }

  private static assertDate(value: string): void {
    try {
      assertCivilDate(value, 'data de fechamento');
    } catch {
      throw new ValidationError('A data de fechamento é inválida.');
    }
  }

  private static assertAmount(value: number, label: string): void {
    if (!Number.isInteger(value) || value < 0 || value > CashClosing.MAX_MONEY_CENTS) {
      throw new ValidationError(`O valor ${label} do caixa é inválido.`);
    }
  }

  private static assertUuid(value: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new ValidationError('O usuário responsável pelo caixa deve ser um UUID válido.');
    }
  }

  private static assertInstant(value: Date): void {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new ValidationError('A data e hora da operação de caixa é inválida.');
    }
  }
}
