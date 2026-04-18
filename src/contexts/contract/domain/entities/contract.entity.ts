import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ValidationError } from '../../../../core/domain/errors/validation.error';

@Entity('contracts')
export class Contract
{
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Column('uuid')
  private _tenantId!: string;

  @Column('uuid')
  private _propertyUnitId!: string;

  @Column('date')
  private _moveInDate!: Date;

  @Column('decimal', { precision: 10, scale: 2 })
  private _monthlyBaseValue!: number;

  @Column('int')
  private _durationInMonths!: number;

  @Column('boolean')
  private _isRenewable!: boolean;

  private constructor() {}

  static create(tenantId: string, propertyUnitId: string, moveInDate: Date, monthlyBaseValue: number, duration: number, renewable: boolean): Contract
  {
    if (monthlyBaseValue <= 0) throw new ValidationError('O valor base mensal deve ser maior que zero.');
    if (duration <= 0) throw new ValidationError('A duração do contrato deve ser de no mínimo 1 mês.');

    const contract = new Contract();
    contract._tenantId = tenantId;
    contract._propertyUnitId = propertyUnitId;
    contract._moveInDate = moveInDate;
    contract._monthlyBaseValue = monthlyBaseValue;
    contract._durationInMonths = duration;
    contract._isRenewable = renewable;
    return contract;
  }

  renew(extraMonths: number): void
  {
    if (!this._isRenewable) throw new ValidationError('Este contrato não permite renovação.');
    this._durationInMonths += extraMonths;
  }

  get monthlyBaseValue(): number { return this._monthlyBaseValue; }
}
