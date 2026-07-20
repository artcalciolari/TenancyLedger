import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  ForeignKey,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ValidationError } from '../../../../core/domain/errors/validation.error';

export interface TenantReferenceFields {
  name: string;
  relationship: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
}

export type UpdateTenantReferenceFields = Partial<TenantReferenceFields>;

@Entity('tenant_references')
@Index('IDX_tenant_references_tenant_created', ['tenantId', 'createdAt', 'id'])
@Check('CHK_tenant_references_name', 'char_length(trim(name)) BETWEEN 2 AND 120')
@Check('CHK_tenant_references_relationship', 'char_length(trim(relationship)) BETWEEN 2 AND 80')
@Check('CHK_tenant_references_phone', "phone ~ '^[1-9]{2}[2-9][0-9]{7,8}$'")
@Check(
  'CHK_tenant_references_email',
  'email IS NULL OR (email = lower(trim(email)) AND char_length(email) <= 254)',
)
@Check(
  'CHK_tenant_references_verification',
  '(verified_at IS NULL AND verified_by IS NULL) OR (verified_at IS NOT NULL AND verified_by IS NOT NULL)',
)
export class TenantReference {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @ForeignKey('Tenant', {
    name: 'FK_tenant_references_tenant',
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  })
  tenantId!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ length: 80 })
  relationship!: string;

  @Column({ length: 13 })
  phone!: string;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email!: string | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  @ForeignKey('User', {
    name: 'FK_tenant_references_verified_by',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  verifiedByUserId!: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  static create(tenantId: string, fields: TenantReferenceFields): TenantReference {
    const reference = new TenantReference();
    reference.tenantId = tenantId;
    reference.name = TenantReference.normalizeRequired(fields.name, 2, 120, 'Nome da referência');
    reference.relationship = TenantReference.normalizeRequired(
      fields.relationship,
      2,
      80,
      'Relacionamento da referência',
    );
    reference.phone = TenantReference.normalizePhone(fields.phone);
    reference.email = TenantReference.normalizeEmail(fields.email);
    reference.notes = TenantReference.normalizeNotes(fields.notes);
    reference.verifiedAt = null;
    reference.verifiedByUserId = null;
    return reference;
  }

  update(fields: UpdateTenantReferenceFields): void {
    const updated = TenantReference.create(this.tenantId, {
      name: fields.name ?? this.name,
      relationship: fields.relationship ?? this.relationship,
      phone: fields.phone ?? this.phone,
      email: fields.email === undefined ? this.email : fields.email,
      notes: fields.notes === undefined ? this.notes : fields.notes,
    });
    const verifiedIdentityChanged =
      updated.name !== this.name ||
      updated.relationship !== this.relationship ||
      updated.phone !== this.phone ||
      updated.email !== this.email;

    this.name = updated.name;
    this.relationship = updated.relationship;
    this.phone = updated.phone;
    this.email = updated.email;
    this.notes = updated.notes;
    if (verifiedIdentityChanged) {
      this.verifiedAt = null;
      this.verifiedByUserId = null;
    }
  }

  markVerified(userId: string, verifiedAt: Date): void {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
    ) {
      throw new ValidationError('Usuário verificador inválido.');
    }
    if (Number.isNaN(verifiedAt.getTime())) {
      throw new ValidationError('Data de verificação inválida.');
    }
    this.verifiedAt = new Date(verifiedAt);
    this.verifiedByUserId = userId;
  }

  private static normalizeRequired(
    value: string,
    minimum: number,
    maximum: number,
    label: string,
  ): string {
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (normalized.length < minimum || normalized.length > maximum) {
      throw new ValidationError(`${label} deve conter entre ${minimum} e ${maximum} caracteres.`);
    }
    return normalized;
  }

  private static normalizePhone(value: string): string {
    let digits = value.replace(/\D/g, '');
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
      digits = digits.slice(2);
    }
    if (!/^[1-9]{2}[2-9]\d{7,8}$/.test(digits)) {
      throw new ValidationError('Telefone da referência inválido.');
    }
    return digits;
  }

  private static normalizeEmail(value: string | null | undefined): string | null {
    if (value === undefined || value === null || value.trim() === '') return null;
    const normalized = value.trim().toLowerCase();
    if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new ValidationError('E-mail da referência inválido.');
    }
    return normalized;
  }

  private static normalizeNotes(value: string | null | undefined): string | null {
    if (value === undefined || value === null || value.trim() === '') return null;
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (normalized.length > 1000) {
      throw new ValidationError('Observações da referência devem ter no máximo 1000 caracteres.');
    }
    return normalized;
  }
}
