import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { CpfVO } from '../value-objects/cpf.vo';

@Entity('tenants')
export class Tenant
{
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Column(() => CpfVO, { prefix: false })
  private _cpf!: CpfVO;

  @Column()
  private _rg!: string;

  @Column()
  private _profession!: string;

  @Column()
  private _civilStatus!: string;

  @Column()
  private _email!: string;

  @Column()
  private _mobilePhone!: string;

  private constructor() {}

  static create(cpf: string, rg: string, profession: string, civilStatus: string, email: string, mobilePhone: string): Tenant
  {
    const tenant = new Tenant();
    tenant._cpf = CpfVO.create(cpf);
    tenant._rg = rg;
    tenant._profession = profession;
    tenant._civilStatus = civilStatus;
    tenant._email = email;
    tenant._mobilePhone = mobilePhone;
    return tenant;
  }

  get cpf(): string { return this._cpf.value; }
  get rg(): string { return this._rg; }
  get profession(): string { return this._profession; }
  get civilStatus(): string { return this._civilStatus; }
  get email(): string { return this._email; }
  get mobilePhone(): string { return this._mobilePhone; }
}
