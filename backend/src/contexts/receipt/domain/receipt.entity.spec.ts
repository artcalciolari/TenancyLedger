import { ValidationError } from '../../../core/domain/errors/validation.error';
import { bigintNumberTransformer, Receipt, type ReceiptSnapshot } from './receipt.entity';

const PAYMENT_ID = '283b10d3-58f2-42d8-aa93-777f55ec9476';
const INVOICE_ID = '0a60a4ca-1a8e-4f0a-b0ee-2196db87ac51';
const CONTRACT_ID = '4d4d05b6-b5db-47c7-91fc-b0c86c036d9f';
const TENANT_ID = '48bb503a-4d2a-4f56-88eb-6f7a9436ec67';
const PROPERTY_ID = 'c2926b25-4e17-44a8-8097-9c093f842cbb';
const ISSUED_AT = new Date('2026-07-18T15:30:00.000Z');

const snapshot: ReceiptSnapshot = {
  paymentTransactionId: PAYMENT_ID,
  invoiceId: INVOICE_ID,
  contractId: CONTRACT_ID,
  tenantId: TENANT_ID,
  tenantName: '  Maria   da Silva  ',
  tenantCpf: '52998224725',
  propertyUnitId: PROPERTY_ID,
  propertyDescription: '  APARTMENT 101-A — Centro  ',
  periodStart: '2026-07-18',
  periodEnd: '2026-08-17',
  amountCents: 185_000,
  paymentMethod: '  CASH  ',
};

function createReceipt(overrides: Partial<ReceiptSnapshot> = {}, number = 42): Receipt {
  return Receipt.create(number, { ...snapshot, ...overrides }, ISSUED_AT);
}

describe('Receipt', () => {
  it('maps PostgreSQL bigint sequence values to safe JavaScript numbers', () => {
    expect(bigintNumberTransformer.to(42)).toBe(42);
    expect(bigintNumberTransformer.from('42')).toBe(42);
  });

  it('creates an immutable payment snapshot with normalized display fields', () => {
    const receipt = createReceipt();

    expect(receipt).toMatchObject({
      number: 42,
      paymentTransactionId: PAYMENT_ID,
      tenantName: 'Maria da Silva',
      propertyDescription: 'APARTMENT 101-A — Centro',
      paymentMethod: 'CASH',
      storageKey: '',
      voidedReason: null,
      voidedAt: null,
    });
    expect(receipt.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(receipt.issuedAt).toEqual(ISSUED_AT);
    expect(receipt.issuedAt).not.toBe(ISSUED_AT);
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid receipt number %s',
    (number) => {
      expect(() => createReceipt({}, number)).toThrow(ValidationError);
    },
  );

  it.each([
    'paymentTransactionId',
    'invoiceId',
    'contractId',
    'tenantId',
    'propertyUnitId',
  ] as const)('rejects an invalid %s UUID', (field) => {
    expect(() => createReceipt({ [field]: 'invalid' })).toThrow(ValidationError);
  });

  it.each([
    ['tenantName', ''],
    ['tenantName', 'x'.repeat(121)],
    ['propertyDescription', ''],
    ['propertyDescription', 'x'.repeat(301)],
    ['paymentMethod', ''],
    ['paymentMethod', 'x'.repeat(31)],
  ] as const)('rejects an invalid %s', (field, value) => {
    expect(() => createReceipt({ [field]: value })).toThrow(ValidationError);
  });

  it('rejects malformed snapshot values', () => {
    expect(() => createReceipt({ tenantCpf: '123' })).toThrow(ValidationError);
    expect(() => createReceipt({ periodStart: '2026-02-31' })).toThrow(ValidationError);
    expect(() => createReceipt({ periodEnd: '2026/08/17' })).toThrow(ValidationError);
    expect(() => createReceipt({ periodStart: '2026-08-18', periodEnd: '2026-08-17' })).toThrow(
      ValidationError,
    );
    expect(() => createReceipt({ amountCents: 0 })).toThrow(ValidationError);
    expect(() => createReceipt({ amountCents: 1.5 })).toThrow(ValidationError);
    expect(() => createReceipt({ amountCents: Number.MAX_SAFE_INTEGER + 1 })).toThrow(
      ValidationError,
    );
    expect(() => Receipt.create(1, snapshot, new Date('invalid'))).toThrow(ValidationError);
  });

  it('accepts only a PDF key in its own receipt folder', () => {
    const receipt = createReceipt();
    const key = `documents/receipts/${receipt.id}/receipt.pdf`;

    receipt.setStorageKey(key);
    expect(receipt.storageKey).toBe(key);
    expect(() => receipt.setStorageKey(`documents/receipts/other/receipt.pdf`)).toThrow(
      ValidationError,
    );
    expect(() => receipt.setStorageKey(`documents/receipts/${receipt.id}/receipt.png`)).toThrow(
      ValidationError,
    );
  });

  it('voids a receipt with a normalized reason and timestamp', () => {
    const receipt = createReceipt();
    const voidedAt = new Date('2026-07-19T12:00:00.000Z');

    receipt.void('  lançamento   duplicado  ', voidedAt);

    expect(receipt.voidedReason).toBe('lançamento duplicado');
    expect(receipt.voidedAt).toEqual(voidedAt);
    expect(receipt.voidedAt).not.toBe(voidedAt);
    expect(() => receipt.void('', voidedAt)).toThrow(ValidationError);
    expect(() => receipt.void('x'.repeat(501), voidedAt)).toThrow(ValidationError);
    expect(() => receipt.void('erro', new Date('invalid'))).toThrow(ValidationError);
  });
});
