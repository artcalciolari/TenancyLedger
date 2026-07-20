import { Check, Column, Entity, ForeignKey, Index, PrimaryColumn, Unique } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { assertCivilDate } from '../../../core/domain/calendar-period';
import { ValidationError } from '../../../core/domain/errors/validation.error';

export interface ReceiptSnapshot {
  paymentTransactionId: string;
  invoiceId: string;
  contractId: string;
  tenantId: string;
  tenantName: string;
  tenantCpf: string;
  propertyUnitId: string;
  propertyDescription: string;
  periodStart: string;
  periodEnd: string;
  amountCents: number;
  paymentMethod: string;
}

export const bigintNumberTransformer = {
  to: (value: number): number => value,
  from: (value: string): number => Number(value),
};

@Entity('receipts')
@Unique('UQ_receipts_number', ['number'])
@Unique('UQ_receipts_payment_transaction', ['paymentTransactionId'])
@Index('IDX_receipts_issued_at', ['issuedAt', 'id'])
@Check('CHK_receipts_number_positive', 'number > 0')
@Check('CHK_receipts_amount_positive', 'amount_cents > 0')
@Check('CHK_receipts_period', 'period_end >= period_start')
@Check('CHK_receipts_tenant_cpf', "tenant_cpf ~ '^[0-9]{11}$'")
@Check(
  'CHK_receipts_void_state',
  '(voided_at IS NULL AND voided_reason IS NULL) OR (voided_at IS NOT NULL AND char_length(trim(voided_reason)) BETWEEN 1 AND 500)',
)
export class Receipt {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'bigint', transformer: bigintNumberTransformer })
  number!: number;

  @Column({ name: 'payment_transaction_id', type: 'uuid' })
  @ForeignKey('PaymentTransaction', {
    name: 'FK_receipts_payment_transaction',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  paymentTransactionId!: string;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId!: string;

  @Column({ name: 'contract_id', type: 'uuid' })
  contractId!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'tenant_name', type: 'varchar', length: 120 })
  tenantName!: string;

  @Column({ name: 'tenant_cpf', type: 'char', length: 11 })
  tenantCpf!: string;

  @Column({ name: 'property_unit_id', type: 'uuid' })
  propertyUnitId!: string;

  @Column({ name: 'property_description', type: 'varchar', length: 300 })
  propertyDescription!: string;

  @Column({ name: 'period_start', type: 'date' })
  periodStart!: string;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd!: string;

  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents!: number;

  @Column({ name: 'payment_method', type: 'varchar', length: 30 })
  paymentMethod!: string;

  @Column({ name: 'issued_at', type: 'timestamptz' })
  issuedAt!: Date;

  @Column({ name: 'storage_key', type: 'varchar', length: 500 })
  storageKey!: string;

  @Column({ name: 'voided_reason', type: 'varchar', length: 500, nullable: true })
  voidedReason!: string | null;

  @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
  voidedAt!: Date | null;

  static create(number: number, snapshot: ReceiptSnapshot, issuedAt: Date): Receipt {
    if (!Number.isSafeInteger(number) || number <= 0) {
      throw new ValidationError('O número do recibo deve ser um inteiro positivo seguro.');
    }
    for (const [label, value] of [
      ['pagamento', snapshot.paymentTransactionId],
      ['fatura', snapshot.invoiceId],
      ['contrato', snapshot.contractId],
      ['locatário', snapshot.tenantId],
      ['unidade', snapshot.propertyUnitId],
    ] as const) {
      Receipt.assertUuid(value, label);
    }
    const tenantName = Receipt.requiredText(snapshot.tenantName, 120, 'Nome do locatário');
    const propertyDescription = Receipt.requiredText(
      snapshot.propertyDescription,
      300,
      'Descrição da unidade',
    );
    const paymentMethod = Receipt.requiredText(snapshot.paymentMethod, 30, 'Método de pagamento');
    if (!/^\d{11}$/.test(snapshot.tenantCpf)) {
      throw new ValidationError('O CPF do recibo deve conter 11 dígitos.');
    }
    Receipt.assertDate(snapshot.periodStart, 'início do período');
    Receipt.assertDate(snapshot.periodEnd, 'fim do período');
    if (snapshot.periodEnd < snapshot.periodStart) {
      throw new ValidationError('O período do recibo é inválido.');
    }
    if (!Number.isSafeInteger(snapshot.amountCents) || snapshot.amountCents <= 0) {
      throw new ValidationError('O valor do recibo deve ser um inteiro positivo em centavos.');
    }
    if (!(issuedAt instanceof Date) || Number.isNaN(issuedAt.getTime())) {
      throw new ValidationError('A data de emissão do recibo é inválida.');
    }

    return Object.assign(new Receipt(), {
      id: randomUUID(),
      number,
      ...snapshot,
      tenantName,
      propertyDescription,
      paymentMethod,
      issuedAt: new Date(issuedAt),
      storageKey: '',
      voidedReason: null,
      voidedAt: null,
    });
  }

  setStorageKey(storageKey: string): void {
    const expectedPrefix = `documents/receipts/${this.id}/`;
    if (!storageKey.startsWith(expectedPrefix) || !storageKey.endsWith('.pdf')) {
      throw new ValidationError('Chave de armazenamento do recibo inválida.');
    }
    this.storageKey = storageKey;
  }

  void(reason: string, voidedAt: Date): void {
    const normalized = Receipt.requiredText(reason, 500, 'Motivo do estorno');
    if (!(voidedAt instanceof Date) || Number.isNaN(voidedAt.getTime())) {
      throw new ValidationError('A data de cancelamento do recibo é inválida.');
    }
    this.voidedReason = normalized;
    this.voidedAt = new Date(voidedAt);
  }

  private static requiredText(value: string, maximum: number, label: string): string {
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized || normalized.length > maximum) {
      throw new ValidationError(`${label} deve conter entre 1 e ${maximum} caracteres.`);
    }
    return normalized;
  }

  private static assertUuid(value: string, label: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new ValidationError(`O ID de ${label} do recibo deve ser um UUID válido.`);
    }
  }

  private static assertDate(value: string, label: string): void {
    assertCivilDate(value, label);
  }
}
