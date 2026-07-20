import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Exclusion,
  ForeignKey,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  addCalendarMonths,
  addCivilDays,
  assertCivilDate,
} from '../../../../core/domain/calendar-period';
import { ConflictError } from '../../../../core/domain/errors/conflict.error';
import { ValidationError } from '../../../../core/domain/errors/validation.error';
import { PropertyUnit } from '../../../property/domain/property-unit.entity';
import { Tenant } from '../../../tenant/domain/entities/tenant.entity';

export enum ContractType {
  FIXED_TERM = 'FIXED_TERM',
  MONTH_TO_MONTH = 'MONTH_TO_MONTH',
}

export enum ContractStatus {
  PENDING_SIGNATURE = 'PENDING_SIGNATURE',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  ACTIVE = 'ACTIVE',
  ENDING = 'ENDING',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED',
  CANCELLED = 'CANCELLED',
}

export enum ContractBadge {
  RENEWAL_DUE = 'RENEWAL_DUE',
  PAYMENT_OVERDUE = 'PAYMENT_OVERDUE',
}

export class ContractStateError extends ConflictError {}

@Entity('contracts')
@Check('CHK_contracts_monthly_value_positive', 'monthly_base_value_cents > 0')
@Check('CHK_contracts_duration_positive', 'duration_in_months IS NULL OR duration_in_months > 0')
@Check('CHK_contracts_billing_day', 'billing_day BETWEEN 1 AND 28')
@Check('CHK_contracts_valid_period', 'end_date IS NULL OR end_date >= move_in_date')
@Check(
  'CHK_contracts_duration_range',
  'duration_in_months IS NULL OR duration_in_months BETWEEN 1 AND 600',
)
@Check(
  'CHK_contracts_type_period',
  "(contract_type = 'FIXED_TERM' AND end_date IS NOT NULL AND duration_in_months IS NOT NULL) OR (contract_type = 'MONTH_TO_MONTH' AND end_date IS NULL AND duration_in_months IS NULL)",
)
@Index('IDX_contracts_tenant_id', ['_tenantId'])
@Index('IDX_contracts_property_unit_id', ['_propertyUnitId'])
@Exclusion(
  'EX_contracts_no_overlapping_period',
  `("property_unit_id" WITH =, daterange("move_in_date", COALESCE("end_date", 'infinity'::date), '[]') WITH &&) WHERE ("status" NOT IN ('TERMINATED'::"contract_status", 'CANCELLED'::"contract_status"))`,
)
export class Contract {
  static readonly MAX_MONEY_CENTS = 2_147_483_647;

  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @ForeignKey(() => Tenant, {
    name: 'FK_contracts_tenant',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  private _tenantId!: string;

  @Column({ name: 'property_unit_id', type: 'uuid' })
  @ForeignKey(() => PropertyUnit, {
    name: 'FK_contracts_property_unit',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  private _propertyUnitId!: string;

  @Column({ name: 'move_in_date', type: 'date' })
  private _moveInDate!: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  private _endDate!: string | null;

  @Column({ name: 'monthly_base_value_cents', type: 'integer' })
  private _monthlyBaseValueCents!: number;

  @Column({ name: 'duration_in_months', type: 'integer', nullable: true })
  private _durationInMonths!: number | null;

  @Column({ name: 'billing_day', type: 'smallint' })
  private _billingDay!: number;

  @Column({ name: 'is_renewable', type: 'boolean' })
  private _isRenewable!: boolean;

  @Column({
    name: 'contract_type',
    type: 'enum',
    enum: ContractType,
    enumName: 'contract_type',
    default: ContractType.FIXED_TERM,
  })
  private _contractType!: ContractType;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ContractStatus,
    enumName: 'contract_status',
    default: ContractStatus.ACTIVE,
  })
  private _status!: ContractStatus;

  @Column({ name: 'status_reason', type: 'varchar', length: 500, nullable: true })
  private _statusReason!: string | null;

  @Column({ name: 'status_changed_at', type: 'timestamptz', default: () => 'now()' })
  private _statusChangedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  readonly createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  readonly updatedAt!: Date;

  private constructor() {}

  static create(
    tenantId: string,
    propertyUnitId: string,
    moveInDate: string,
    monthlyBaseValueCents: number,
    durationInMonths: number | null,
    isRenewable: boolean,
    billingDay?: number,
    contractType = ContractType.FIXED_TERM,
  ): Contract {
    return Contract.createWithStatus(
      tenantId,
      propertyUnitId,
      moveInDate,
      monthlyBaseValueCents,
      durationInMonths,
      isRenewable,
      billingDay,
      contractType,
      ContractStatus.ACTIVE,
    );
  }

  static createPendingSignature(
    tenantId: string,
    propertyUnitId: string,
    moveInDate: string,
    monthlyBaseValueCents: number,
    billingDay?: number,
  ): Contract {
    return Contract.createWithStatus(
      tenantId,
      propertyUnitId,
      moveInDate,
      monthlyBaseValueCents,
      null,
      true,
      billingDay,
      ContractType.MONTH_TO_MONTH,
      ContractStatus.PENDING_SIGNATURE,
    );
  }

  private static createWithStatus(
    tenantId: string,
    propertyUnitId: string,
    moveInDate: string,
    monthlyBaseValueCents: number,
    durationInMonths: number | null,
    isRenewable: boolean,
    billingDay: number | undefined,
    contractType: ContractType,
    status: ContractStatus,
  ): Contract {
    Contract.assertUuid(tenantId, 'inquilino');
    Contract.assertUuid(propertyUnitId, 'unidade imobiliária');
    Contract.assertDate(moveInDate, 'data de entrada');
    Contract.assertPositiveInteger(monthlyBaseValueCents, 'valor base mensal em centavos');
    if (!Object.values(ContractType).includes(contractType)) {
      throw new ValidationError('O tipo do contrato é inválido.');
    }
    if (contractType === ContractType.FIXED_TERM) {
      if (durationInMonths === null) {
        throw new ValidationError('Contratos com prazo fixo exigem duração em meses.');
      }
      Contract.assertDuration(durationInMonths);
    } else if (durationInMonths !== null) {
      throw new ValidationError('Contratos mensais não possuem duração fixa.');
    }
    if (typeof isRenewable !== 'boolean') {
      throw new ValidationError('A indicação de renovação deve ser booleana.');
    }

    const resolvedBillingDay = billingDay ?? Math.min(Number(moveInDate.slice(8, 10)), 28);
    if (
      !Number.isInteger(resolvedBillingDay) ||
      resolvedBillingDay < 1 ||
      resolvedBillingDay > 28
    ) {
      throw new ValidationError('O dia de vencimento deve ser um inteiro entre 1 e 28.');
    }

    const contract = new Contract();
    contract._tenantId = tenantId;
    contract._propertyUnitId = propertyUnitId;
    contract._moveInDate = moveInDate;
    contract._durationInMonths = durationInMonths;
    contract._endDate =
      contractType === ContractType.FIXED_TERM
        ? Contract.calculateEndDate(moveInDate, durationInMonths as number)
        : null;
    contract._monthlyBaseValueCents = monthlyBaseValueCents;
    contract._billingDay = resolvedBillingDay;
    contract._isRenewable = isRenewable;
    contract._contractType = contractType;
    contract._status = status;
    contract._statusReason = null;
    contract._statusChangedAt = new Date();
    return contract;
  }

  renew(extraMonths: number): void {
    if (this._contractType === ContractType.MONTH_TO_MONTH) {
      throw new ContractStateError('Contratos mensais já se renovam automaticamente.');
    }
    Contract.assertDuration(extraMonths, 'A renovação');
    if (!this._isRenewable) {
      throw new ContractStateError('Este contrato não permite renovação.');
    }
    if (![ContractStatus.ACTIVE, ContractStatus.EXPIRED].includes(this._status)) {
      throw new ContractStateError('O estado atual do contrato não permite renovação.');
    }
    const currentDuration = this._durationInMonths as number;
    if (currentDuration + extraMonths > 600) {
      throw new ValidationError('A vigência total do contrato não pode exceder 600 meses.');
    }

    this._durationInMonths = currentDuration + extraMonths;
    this._endDate = Contract.calculateEndDate(this._moveInDate, this._durationInMonths);
    this.changeStatus(ContractStatus.ACTIVE, null);
  }

  markSigned(changedAt = new Date()): void {
    this.assertStatus(ContractStatus.PENDING_SIGNATURE, 'assinado');
    this.changeStatus(ContractStatus.PAYMENT_PENDING, null, changedAt);
  }

  activate(changedAt = new Date()): void {
    this.assertStatus(ContractStatus.PAYMENT_PENDING, 'ativado');
    this.changeStatus(ContractStatus.ACTIVE, null, changedAt);
  }

  scheduleEnding(reason: string, changedAt = new Date()): void {
    this.assertStatus(ContractStatus.ACTIVE, 'programado para encerramento');
    this.changeStatus(ContractStatus.ENDING, Contract.requiredReason(reason), changedAt);
  }

  cancel(reason: string, changedAt = new Date()): void {
    if (
      ![ContractStatus.PENDING_SIGNATURE, ContractStatus.PAYMENT_PENDING].includes(this._status)
    ) {
      throw new ContractStateError('Somente um contrato ainda não ativo pode ser cancelado.');
    }
    this.changeStatus(ContractStatus.CANCELLED, Contract.requiredReason(reason), changedAt);
  }

  terminate(reason: string, changedAt = new Date()): void {
    if (![ContractStatus.ACTIVE, ContractStatus.ENDING].includes(this._status)) {
      throw new ContractStateError('O estado atual do contrato não permite encerramento.');
    }
    this.changeStatus(ContractStatus.TERMINATED, Contract.requiredReason(reason), changedAt);
  }

  markExpired(asOf: string): void {
    Contract.assertDate(asOf, 'data de referência');
    if (this._contractType === ContractType.MONTH_TO_MONTH) return;
    if (
      [ContractStatus.ACTIVE, ContractStatus.ENDING].includes(this._status) &&
      (this._endDate as string) < asOf
    ) {
      this.changeStatus(ContractStatus.EXPIRED, null);
    }
  }

  isActiveOn(date: string): boolean {
    Contract.assertDate(date, 'data de referência');
    return (
      [ContractStatus.ACTIVE, ContractStatus.ENDING].includes(this._status) &&
      this._moveInDate <= date &&
      (this._endDate === null || this._endDate >= date)
    );
  }

  isOccupyingOn(date: string): boolean {
    Contract.assertDate(date, 'data de referência');
    return (
      ![ContractStatus.TERMINATED, ContractStatus.CANCELLED].includes(this._status) &&
      this._moveInDate <= date &&
      (this._endDate === null || this._endDate >= date)
    );
  }

  dueDateFor(competence: string): string {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competence)) {
      throw new ValidationError('A competência deve estar no formato AAAA-MM.');
    }
    return `${competence}-${String(this._billingDay).padStart(2, '0')}`;
  }

  static calculateEndDate(moveInDate: string, durationInMonths: number): string {
    Contract.assertDate(moveInDate, 'data de entrada');
    Contract.assertDuration(durationInMonths);
    return addCivilDays(addCalendarMonths(moveInDate, durationInMonths), -1);
  }

  private assertStatus(expected: ContractStatus, action: string): void {
    if (this._status !== expected) {
      throw new ContractStateError(`Somente um contrato ${expected} pode ser ${action}.`);
    }
  }

  private changeStatus(
    status: ContractStatus,
    reason: string | null,
    changedAt = new Date(),
  ): void {
    if (!(changedAt instanceof Date) || Number.isNaN(changedAt.getTime())) {
      throw new ValidationError('A data da mudança de status do contrato é inválida.');
    }
    this._status = status;
    this._statusReason = reason;
    this._statusChangedAt = new Date(changedAt);
  }

  private static requiredReason(value: string): string {
    const normalized = value?.trim();
    if (!normalized || normalized.length > 500) {
      throw new ValidationError('O motivo deve conter entre 1 e 500 caracteres.');
    }
    return normalized;
  }

  private static assertUuid(value: string, field: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new ValidationError(`O ID de ${field} deve ser um UUID válido.`);
    }
  }

  private static assertDate(value: string, field: string): void {
    assertCivilDate(value, field);
  }

  private static assertPositiveInteger(value: number, field: string): void {
    if (!Number.isSafeInteger(value) || value <= 0 || value > Contract.MAX_MONEY_CENTS) {
      throw new ValidationError(
        `O ${field} deve ser um inteiro positivo de até ${Contract.MAX_MONEY_CENTS}.`,
      );
    }
  }

  private static assertDuration(value: number, subject = 'A duração do contrato'): void {
    if (!Number.isInteger(value) || value < 1 || value > 600) {
      throw new ValidationError(`${subject} deve ser um número inteiro entre 1 e 600 meses.`);
    }
  }

  get tenantId(): string {
    return this._tenantId;
  }
  get propertyUnitId(): string {
    return this._propertyUnitId;
  }
  get moveInDate(): string {
    return this._moveInDate;
  }
  get endDate(): string | null {
    return this._endDate;
  }
  get monthlyBaseValueCents(): number {
    return this._monthlyBaseValueCents;
  }
  get durationInMonths(): number | null {
    return this._durationInMonths;
  }
  get billingDay(): number {
    return this._billingDay;
  }
  get isRenewable(): boolean {
    return this._isRenewable;
  }
  get contractType(): ContractType {
    return this._contractType;
  }
  get status(): ContractStatus {
    return this._status;
  }
  get statusReason(): string | null {
    return this._statusReason;
  }
  get statusChangedAt(): Date {
    return new Date(this._statusChangedAt);
  }
}
