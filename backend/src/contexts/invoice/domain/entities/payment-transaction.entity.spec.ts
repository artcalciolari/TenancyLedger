import { ValidationError } from '../../../../core/domain/errors/validation.error';
import { Invoice } from './invoice.entity';
import {
  PaymentMethod,
  PaymentStateError,
  PaymentStatus,
  PaymentTransaction,
  ProofType,
} from './payment-transaction.entity';

const CONTRACT_ID = 'a18175e8-a5b5-4f55-bd57-b5631a70b8f5';
const SUBMITTER_ID = '7fdf9cde-2961-4ed2-a3ae-eedce12a42ee';
const REVIEWER_ID = 'e5c1163a-8151-41e3-b953-350cb36435b1';
const SUBMITTED_AT = new Date('2026-07-10T12:00:00.000Z');
const REVIEWED_AT = new Date('2026-07-10T13:00:00.000Z');
const IDEMPOTENCY_KEY = 'payment-attempt-0001';
const REQUEST_FINGERPRINT = 'a'.repeat(64);

interface TransactionInput {
  amountCents: number;
  method: PaymentMethod;
  proofType: ProofType | null;
  proofReference: string | undefined;
  submittedAt: Date;
  idempotencyKey: string;
  requestFingerprint: string;
  submittedByUserId: string;
}

function createTransaction(overrides: Partial<TransactionInput> = {}): PaymentTransaction {
  const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-15');
  const input: TransactionInput = {
    amountCents: 25_00,
    method: PaymentMethod.CASH,
    proofType: null,
    proofReference: undefined,
    submittedAt: SUBMITTED_AT,
    idempotencyKey: IDEMPOTENCY_KEY,
    requestFingerprint: REQUEST_FINGERPRINT,
    submittedByUserId: SUBMITTER_ID,
    ...overrides,
  };

  return PaymentTransaction.create(
    invoice,
    input.amountCents,
    input.method,
    input.proofType,
    input.proofReference,
    input.submittedAt,
    input.idempotencyKey,
    input.requestFingerprint,
    input.submittedByUserId,
  );
}

describe('PaymentTransaction', () => {
  it('creates a normalized submitted payment and isolates its submission date', () => {
    const submittedAt = new Date(SUBMITTED_AT);
    const transaction = createTransaction({
      method: PaymentMethod.PIX,
      proofType: ProofType.DIGITAL_SLIP,
      proofReference: '  proofs/payment-1.pdf  ',
      submittedAt,
    });

    submittedAt.setUTCFullYear(2030);
    const exposedDate = transaction.submittedAt;
    exposedDate.setUTCFullYear(2031);

    expect(transaction.status).toBe(PaymentStatus.SUBMITTED);
    expect(transaction.proofReference).toBe('proofs/payment-1.pdf');
    expect(transaction.submittedAt.toISOString()).toBe('2026-07-10T12:00:00.000Z');
    expect(transaction.reviewedAt).toBeNull();
    expect(transaction.rejectionReason).toBeNull();
    expect(transaction.reviewedByUserId).toBeNull();
  });

  it('accepts a cash payment without proof', () => {
    expect(() => createTransaction()).not.toThrow();
  });

  it('creates a direct cash settlement already approved by the same actor', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-15');
    const transaction = PaymentTransaction.createDirectSettlement(
      invoice,
      100_00,
      PaymentMethod.CASH,
      SUBMITTED_AT,
      IDEMPOTENCY_KEY,
      REQUEST_FINGERPRINT,
      SUBMITTER_ID,
    );

    expect(transaction).toMatchObject({
      status: PaymentStatus.APPROVED,
      method: PaymentMethod.CASH,
      isDirectSettlement: true,
      submittedByUserId: SUBMITTER_ID,
      reviewedByUserId: SUBMITTER_ID,
      reversalReason: null,
      reversedByUserId: null,
    });
    expect(transaction.reviewedAt).toEqual(SUBMITTED_AT);
  });

  it('rejects a non-cash direct settlement', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-15');

    expect(() =>
      PaymentTransaction.createDirectSettlement(
        invoice,
        100_00,
        PaymentMethod.PIX,
        SUBMITTED_AT,
        IDEMPOTENCY_KEY,
        REQUEST_FINGERPRINT,
        SUBMITTER_ID,
      ),
    ).toThrow(ValidationError);
  });

  it.each([
    {
      scenario: 'zero amount',
      create: () => createTransaction({ amountCents: 0 }),
    },
    {
      scenario: 'fractional amount',
      create: () => createTransaction({ amountCents: 10.5 }),
    },
    {
      scenario: 'amount above the maximum',
      create: () => createTransaction({ amountCents: Invoice.MAX_MONEY_CENTS + 1 }),
    },
    {
      scenario: 'unknown payment method',
      create: () => createTransaction({ method: 'CARD' as PaymentMethod }),
    },
    {
      scenario: 'unknown proof type',
      create: () =>
        createTransaction({
          method: PaymentMethod.PIX,
          proofType: 'PHOTO' as ProofType,
          proofReference: 'proof/1',
        }),
    },
    {
      scenario: 'non-Date submission timestamp',
      create: () => createTransaction({ submittedAt: '2026-07-10' as unknown as Date }),
    },
    {
      scenario: 'invalid submission timestamp',
      create: () => createTransaction({ submittedAt: new Date(Number.NaN) }),
    },
    {
      scenario: 'invalid request fingerprint',
      create: () => createTransaction({ requestFingerprint: 'A'.repeat(64) }),
    },
    {
      scenario: 'invalid submitter ID',
      create: () => createTransaction({ submittedByUserId: 'not-a-uuid' }),
    },
    {
      scenario: 'proof reference above the maximum',
      create: () =>
        createTransaction({
          method: PaymentMethod.PIX,
          proofType: ProofType.DIGITAL_SLIP,
          proofReference: ` ${'x'.repeat(501)} `,
        }),
    },
    {
      scenario: 'non-cash payment without proof type',
      create: () =>
        createTransaction({
          method: PaymentMethod.BANK_TRANSFER,
          proofType: null,
          proofReference: 'statement/1',
        }),
    },
    {
      scenario: 'non-cash payment without proof reference',
      create: () =>
        createTransaction({
          method: PaymentMethod.BANK_TRANSFER,
          proofType: ProofType.BANK_STATEMENT,
          proofReference: '   ',
        }),
    },
  ])('rejects $scenario', ({ create }) => {
    expect(create).toThrow(ValidationError);
  });

  it.each([undefined, '1234567', 'x'.repeat(129), 'has space', 'abcd\nefgh', 'abcdefgé'])(
    'rejects invalid idempotency key %p',
    (value) => {
      expect(() => PaymentTransaction.assertIdempotencyKey(value)).toThrow(ValidationError);
    },
  );

  it.each(['12345678', '!'.repeat(128)])('accepts boundary idempotency key %p', (value) => {
    expect(() => PaymentTransaction.assertIdempotencyKey(value)).not.toThrow();
  });

  it.each([
    ['a non-Date timestamp', '2026-07-10' as unknown as Date, REVIEWER_ID],
    ['an invalid timestamp', new Date(Number.NaN), REVIEWER_ID],
    ['a timestamp before submission', new Date('2026-07-10T11:59:59.999Z'), REVIEWER_ID],
    ['an invalid reviewer ID', REVIEWED_AT, 'not-a-uuid'],
  ])('rejects review with %s', (_scenario, reviewedAt, reviewerId) => {
    const transaction = createTransaction();

    expect(() => transaction.approve(reviewedAt, reviewerId)).toThrow(ValidationError);
    expect(transaction.status).toBe(PaymentStatus.SUBMITTED);
  });

  it('prevents the submitter from reviewing their own payment', () => {
    const transaction = createTransaction();

    expect(() => transaction.approve(REVIEWED_AT, SUBMITTER_ID)).toThrow(PaymentStateError);
    expect(transaction.status).toBe(PaymentStatus.SUBMITTED);
  });

  it('approves once, records an isolated review date, and rejects another review', () => {
    const reviewedAt = new Date(REVIEWED_AT);
    const transaction = createTransaction();

    transaction.approve(reviewedAt, REVIEWER_ID);
    reviewedAt.setUTCFullYear(2030);
    const exposedDate = transaction.reviewedAt;
    exposedDate?.setUTCFullYear(2031);

    expect(transaction.status).toBe(PaymentStatus.APPROVED);
    expect(transaction.reviewedAt?.toISOString()).toBe('2026-07-10T13:00:00.000Z');
    expect(transaction.reviewedByUserId).toBe(REVIEWER_ID);
    expect(() => transaction.reject('late rejection', REVIEWED_AT, REVIEWER_ID)).toThrow(
      PaymentStateError,
    );
  });

  it.each([undefined as unknown as string, '', '   ', 'x'.repeat(501)])(
    'rejects invalid rejection reason %p',
    (reason) => {
      const transaction = createTransaction();

      expect(() => transaction.reject(reason, REVIEWED_AT, REVIEWER_ID)).toThrow(ValidationError);
      expect(transaction.status).toBe(PaymentStatus.SUBMITTED);
    },
  );

  it('rejects once with a normalized reason and rejects another review', () => {
    const transaction = createTransaction();

    transaction.reject('  Comprovante ilegível  ', REVIEWED_AT, REVIEWER_ID);

    expect(transaction.status).toBe(PaymentStatus.REJECTED);
    expect(transaction.rejectionReason).toBe('Comprovante ilegível');
    expect(transaction.reviewedByUserId).toBe(REVIEWER_ID);
    expect(() => transaction.approve(REVIEWED_AT, REVIEWER_ID)).toThrow(PaymentStateError);
  });

  it('reverses an approved payment with an isolated timestamp', () => {
    const transaction = createTransaction();
    transaction.approve(REVIEWED_AT, REVIEWER_ID);
    const reversedAt = new Date('2026-07-10T14:00:00.000Z');

    transaction.reverse('  lançamento duplicado  ', reversedAt, SUBMITTER_ID);
    reversedAt.setUTCFullYear(2030);
    const exposedDate = transaction.reversedAt;
    exposedDate?.setUTCFullYear(2031);

    expect(transaction.status).toBe(PaymentStatus.REVERSED);
    expect(transaction.reversalReason).toBe('lançamento duplicado');
    expect(transaction.reversedAt?.toISOString()).toBe('2026-07-10T14:00:00.000Z');
  });

  it('rejects reversal before approval', () => {
    const transaction = createTransaction();

    expect(() =>
      transaction.reverse('Correção', new Date('2026-07-10T14:00:00.000Z'), REVIEWER_ID),
    ).toThrow(PaymentStateError);
    expect(transaction.reversedAt).toBeNull();
  });

  it.each([
    ['an empty reason', '', new Date('2026-07-10T14:00:00.000Z')],
    ['a long reason', 'x'.repeat(501), new Date('2026-07-10T14:00:00.000Z')],
    ['an invalid timestamp', 'Correção', new Date(Number.NaN)],
    ['a timestamp before review', 'Correção', new Date('2026-07-10T12:30:00.000Z')],
  ])('rejects reversal with %s', (_scenario, reason, reversedAt) => {
    const transaction = createTransaction();
    transaction.approve(REVIEWED_AT, REVIEWER_ID);

    expect(() => transaction.reverse(reason, reversedAt, SUBMITTER_ID)).toThrow(ValidationError);
    expect(transaction.status).toBe(PaymentStatus.APPROVED);
  });
});
