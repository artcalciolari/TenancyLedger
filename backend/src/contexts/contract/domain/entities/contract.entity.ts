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
import { ConflictError } from '../../../../core/domain/errors/conflict.error';
import { ValidationError } from '../../../../core/domain/errors/validation.error';
import { PropertyUnit } from '../../../property/domain/property-unit.entity';
import { Tenant } from '../../../tenant/domain/entities/tenant.entity';

export enum ContractStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED',
}

export class ContractStateError extends ConflictError {}

@Entity('contracts')
@Check('CHK_contracts_monthly_value_positive', 'monthly_base_value_cents > 0')
@Check('CHK_contracts_duration_positive', 'duration_in_months > 0')
@Check('CHK_contracts_billing_day', 'billing_day BETWEEN 1 AND 28')
@Check('CHK_contracts_valid_period', 'end_date >= move_in_date')
@Check('CHK_contracts_duration_range', 'duration_in_months BETWEEN 1 AND 600')
@Index('IDX_contracts_tenant_id', ['_tenantId'])
@Index('IDX_contracts_property_unit_id', ['_propertyUnitId'])
@Exclusion(
  'EX_contracts_no_overlapping_period',
  `("property_unit_id" WITH =, daterange("move_in_date", "end_date", '[]') WITH &&) WHERE ("status" <> 'TERMINATED'::"contract_status")`,
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

  @Column({ name: 'end_date', type: 'date' })
  private _endDate!: string;

  @Column({ name: 'monthly_base_value_cents', type: 'integer' })
  private _monthlyBaseValueCents!: number;

  @Column({ name: 'duration_in_months', type: 'integer' })
  private _durationInMonths!: number;

  @Column({ name: 'billing_day', type: 'smallint' })
  private _billingDay!: number;

  @Column({ name: 'is_renewable', type: 'boolean' })
  private _isRenewable!: boolean;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ContractStatus,
    enumName: 'contract_status',
    default: ContractStatus.ACTIVE,
  })
  private _status!: ContractStatus;

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
    durationInMonths: number,
    isRenewable: boolean,
    billingDay?: number,
  ): Contract {
    Contract.assertUuid(tenantId, 'inquilino');
    Contract.assertUuid(propertyUnitId, 'unidade imobiliária');
    Contract.assertDate(moveInDate, 'data de entrada');
    Contract.assertPositiveInteger(monthlyBaseValueCents, 'valor base mensal em centavos');
    Contract.assertDuration(durationInMonths);

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
    contract._endDate = Contract.calculateEndDate(moveInDate, durationInMonths);
    contract._monthlyBaseValueCents = monthlyBaseValueCents;
    contract._billingDay = resolvedBillingDay;
    contract._isRenewable = isRenewable;
    contract._status = ContractStatus.ACTIVE;
    return contract;
  }

  renew(extraMonths: number): void {
    Contract.assertDuration(extraMonths, 'A renovação');
    if (!this._isRenewable) {
      throw new ContractStateError('Este contrato não permite renovação.');
    }
    if (this._status === ContractStatus.TERMINATED) {
      throw new ContractStateError('Um contrato encerrado não pode ser renovado.');
    }
    if (this._durationInMonths + extraMonths > 600) {
      throw new ValidationError('A vigência total do contrato não pode exceder 600 meses.');
    }

    this._durationInMonths += extraMonths;
    this._endDate = Contract.calculateEndDate(this._moveInDate, this._durationInMonths);
    this._status = ContractStatus.ACTIVE;
  }

  markExpired(asOf: string): void {
    Contract.assertDate(asOf, 'data de referência');
    if (this._status === ContractStatus.ACTIVE && this._endDate < asOf) {
      this._status = ContractStatus.EXPIRED;
    }
  }

  isActiveOn(date: string): boolean {
    Contract.assertDate(date, 'data de referência');
    return (
      this._status === ContractStatus.ACTIVE && this._moveInDate <= date && this._endDate >= date
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
    const year = Number(moveInDate.slice(0, 4));
    const month = Number(moveInDate.slice(5, 7));
    const day = Number(moveInDate.slice(8, 10));
    const absoluteMonth = year * 12 + (month - 1) + durationInMonths;
    const targetYear = Math.floor(absoluteMonth / 12);
    const targetMonth = absoluteMonth % 12;
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const exclusive = new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)));
    exclusive.setUTCDate(exclusive.getUTCDate() - 1);
    return exclusive.toISOString().slice(0, 10);
  }

  private static assertUuid(value: string, field: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new ValidationError(`O ID de ${field} deve ser um UUID válido.`);
    }
  }

  private static assertDate(value: string, field: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new ValidationError(`A ${field} deve estar no formato AAAA-MM-DD.`);
    }
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(5, 7));
    const day = Number(value.slice(8, 10));
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new ValidationError(`A ${field} é inválida.`);
    }
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
  get endDate(): string {
    return this._endDate;
  }
  get monthlyBaseValueCents(): number {
    return this._monthlyBaseValueCents;
  }
  get durationInMonths(): number {
    return this._durationInMonths;
  }
  get billingDay(): number {
    return this._billingDay;
  }
  get isRenewable(): boolean {
    return this._isRenewable;
  }
  get status(): ContractStatus {
    return this._status;
  }
}
