import {
  Column,
  Check,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CpfVO } from '../value-objects/cpf.vo';
import { ValidationError } from '../../../../core/domain/errors/validation.error';

export enum TenantCivilStatus {
  SINGLE = 'SINGLE',
  MARRIED = 'MARRIED',
  DIVORCED = 'DIVORCED',
  WIDOWED = 'WIDOWED',
  STABLE_UNION = 'STABLE_UNION',
}

export interface UpdateTenantProfileFields {
  name?: string;
  profession?: string;
  civilStatus?: TenantCivilStatus;
  email?: string;
  mobilePhone?: string;
}

@Entity('tenants')
@Check('CHK_tenants_cpf_digits', "cpf ~ '^[0-9]{11}$'")
@Check('CHK_tenants_mobile_digits', "mobile_phone ~ '^[1-9]{2}9[0-9]{8}$'")
@Check('CHK_tenants_email_normalized', 'email = lower(trim(email))')
@Check('CHK_tenants_rg_not_blank', 'char_length(trim(rg)) BETWEEN 5 AND 20')
@Check('CHK_tenants_profession_not_blank', 'char_length(trim(profession)) BETWEEN 2 AND 100')
@Check('CHK_tenants_full_name_not_blank', 'char_length(trim(full_name)) BETWEEN 3 AND 120')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'full_name', length: 120 })
  name!: string;

  @Column({ length: 11, unique: true })
  cpf!: string;

  @Column({ length: 20 })
  rg!: string;

  @Column({ length: 100 })
  profession!: string;

  @Column({
    name: 'civil_status',
    type: 'enum',
    enum: TenantCivilStatus,
    enumName: 'tenant_civil_status',
  })
  civilStatus!: TenantCivilStatus;

  @Column({ length: 254, unique: true })
  email!: string;

  @Column({ name: 'mobile_phone', length: 13, unique: true })
  mobilePhone!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  static create(
    name: string,
    cpf: string,
    rg: string,
    profession: string,
    civilStatus: TenantCivilStatus,
    email: string,
    mobilePhone: string,
  ): Tenant {
    const normalizedName = name.trim().replace(/\s+/g, ' ');
    const normalizedRg = rg.trim().toUpperCase();
    const normalizedProfession = profession.trim().replace(/\s+/g, ' ');
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedName.length < 3 || normalizedName.length > 120) {
      throw new ValidationError('Nome deve conter entre 3 e 120 caracteres.');
    }
    if (
      normalizedRg.length < 5 ||
      normalizedRg.length > 20 ||
      !/^[\p{L}\d.\-/]+$/u.test(normalizedRg)
    ) {
      throw new ValidationError('RG inválido.');
    }
    if (normalizedProfession.length < 2 || normalizedProfession.length > 100) {
      throw new ValidationError('Profissão deve conter entre 2 e 100 caracteres.');
    }
    if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new ValidationError('E-mail inválido.');
    }
    if (!Object.values(TenantCivilStatus).includes(civilStatus)) {
      throw new ValidationError('Estado civil inválido.');
    }

    const tenant = new Tenant();
    tenant.name = normalizedName;
    tenant.cpf = CpfVO.create(cpf).value;
    tenant.rg = normalizedRg;
    tenant.profession = normalizedProfession;
    tenant.civilStatus = civilStatus;
    tenant.email = normalizedEmail;
    tenant.mobilePhone = Tenant.normalizeMobilePhone(mobilePhone);
    return tenant;
  }

  updateProfile(fields: UpdateTenantProfileFields): void {
    const updated = Tenant.create(
      fields.name ?? this.name,
      this.cpf,
      this.rg,
      fields.profession ?? this.profession,
      fields.civilStatus ?? this.civilStatus,
      fields.email ?? this.email,
      fields.mobilePhone ?? this.mobilePhone,
    );
    this.name = updated.name;
    this.profession = updated.profession;
    this.civilStatus = updated.civilStatus;
    this.email = updated.email;
    this.mobilePhone = updated.mobilePhone;
  }

  static normalizeMobilePhone(value: string): string {
    let digits = value.replace(/\D/g, '');
    if (digits.length === 13 && digits.startsWith('55')) {
      digits = digits.slice(2);
    }
    if (!/^[1-9]{2}9\d{8}$/.test(digits)) {
      throw new ValidationError('Telefone celular inválido.');
    }
    return digits;
  }
}
