import { ValidationError } from '../../../../core/domain/errors/validation.error';
import { Invoice, InvoiceStateError, InvoiceStatus } from './invoice.entity';
import {
  PaymentMethod,
  PaymentStateError,
  PaymentStatus,
  PaymentTransaction,
  ProofType,
} from './payment-transaction.entity';

const CONTRACT_ID = 'a18175e8-a5b5-4f55-bd57-b5631a70b8f5';
const NOW = new Date('2026-07-10T12:00:00.000Z');
const IDEMPOTENCY_KEY = 'payment-attempt-0001';
const SECOND_IDEMPOTENCY_KEY = 'payment-attempt-0002';
const REQUEST_FINGERPRINT = 'a'.repeat(64);
const SUBMITTER_ID = '7fdf9cde-2961-4ed2-a3ae-eedce12a42ee';
const REVIEWER_ID = 'e5c1163a-8151-41e3-b953-350cb36435b1';

function assignId(target: object, id: string): void {
  Object.defineProperty(target, 'id', { value: id, configurable: true });
}

function submitCashPayment(
  invoice: Invoice,
  amountCents: number,
  idempotencyKey = IDEMPOTENCY_KEY,
  requestFingerprint = REQUEST_FINGERPRINT,
): PaymentTransaction {
  return invoice.submitPayment(
    amountCents,
    PaymentMethod.CASH,
    null,
    undefined,
    NOW,
    idempotencyKey,
    requestFingerprint,
    SUBMITTER_ID,
  );
}

describe('Invoice payment state machine', () => {
  it('creates an open invoice with an explicit competence', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 150_00, '2026-07-15');

    expect(invoice.status).toBe(InvoiceStatus.OPEN);
    expect(invoice.totalValueCents).toBe(150_00);
    expect(invoice.approvedAmountCents).toBe(0);
    expect(invoice.outstandingAmountCents).toBe(150_00);
    expect(invoice.periodStart).toBe('2026-07-01');
    expect(invoice.periodEnd).toBe('2026-07-31');
  });

  it('stores an inclusive month-to-month coverage period', () => {
    const invoice = Invoice.create(
      CONTRACT_ID,
      '2026-07',
      150_00,
      '2026-07-18',
      '2026-07-18',
      '2026-08-17',
    );

    expect(invoice.periodStart).toBe('2026-07-18');
    expect(invoice.periodEnd).toBe('2026-08-17');
  });

  it.each([
    ['end before start', '2026-07', '2026-07-18', '2026-07-17'],
    ['competence mismatch', '2026-07', '2026-08-01', '2026-08-31'],
  ])('rejects an invalid coverage period: %s', (_scenario, competence, start, end) => {
    expect(() => Invoice.create(CONTRACT_ID, competence, 150_00, '2026-07-15', start, end)).toThrow(
      ValidationError,
    );
  });

  it('moves SUBMITTED -> APPROVED and counts only approved payments', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 150_00, '2026-07-15');
    const payment = invoice.submitPayment(
      50_00,
      PaymentMethod.PIX,
      ProofType.DIGITAL_SLIP,
      'proof/1',
      NOW,
      IDEMPOTENCY_KEY,
      REQUEST_FINGERPRINT,
      SUBMITTER_ID,
    );
    assignId(payment, 'cb7b6dfd-b0c2-4414-a45a-a2cd467308f6');

    expect(payment.status).toBe(PaymentStatus.SUBMITTED);
    expect(invoice.status).toBe(InvoiceStatus.UNDER_REVIEW);
    expect(invoice.approvedAmountCents).toBe(0);

    invoice.approvePayment(payment.id, new Date('2026-07-10T13:00:00.000Z'), REVIEWER_ID);

    expect(payment.status).toBe(PaymentStatus.APPROVED);
    expect(invoice.approvedAmountCents).toBe(50_00);
    expect(invoice.outstandingAmountCents).toBe(100_00);
    expect(invoice.status).toBe(InvoiceStatus.PARTIALLY_PAID);
  });

  it('settles cash directly and restores the invoice balance after reversal', () => {
    const invoice = Invoice.create(
      CONTRACT_ID,
      '2026-07',
      100_00,
      '2026-07-15',
      '2026-07-10',
      '2026-08-09',
    );
    const payment = invoice.settleCash(
      100_00,
      NOW,
      IDEMPOTENCY_KEY,
      REQUEST_FINGERPRINT,
      SUBMITTER_ID,
      '2026-07-10',
    );
    assignId(payment, 'cb7b6dfd-b0c2-4414-a45a-a2cd467308f6');

    expect(payment).toMatchObject({
      status: PaymentStatus.APPROVED,
      isDirectSettlement: true,
      reviewedByUserId: SUBMITTER_ID,
    });
    expect(invoice.status).toBe(InvoiceStatus.PAID);

    invoice.reversePayment(
      payment.id,
      'Erro de lançamento',
      new Date('2026-07-10T13:00:00.000Z'),
      REVIEWER_ID,
    );

    expect(payment.status).toBe(PaymentStatus.REVERSED);
    expect(payment.reversalReason).toBe('Erro de lançamento');
    expect(invoice.approvedAmountCents).toBe(0);
    expect(invoice.outstandingAmountCents).toBe(100_00);
    expect(invoice.status).toBe(InvoiceStatus.OPEN);
  });

  it.each([0, 0.5, Invoice.MAX_MONEY_CENTS + 1])(
    'rejects invalid direct cash amount %s',
    (amountCents) => {
      const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-15');

      expect(() =>
        invoice.settleCash(amountCents, NOW, IDEMPOTENCY_KEY, REQUEST_FINGERPRINT, SUBMITTER_ID),
      ).toThrow(ValidationError);
    },
  );

  it('rejects direct settlement of an already paid invoice', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-15');
    invoice.settleCash(100_00, NOW, IDEMPOTENCY_KEY, REQUEST_FINGERPRINT, SUBMITTER_ID);

    expect(() =>
      invoice.settleCash(1, NOW, SECOND_IDEMPOTENCY_KEY, 'b'.repeat(64), SUBMITTER_ID),
    ).toThrow(InvoiceStateError);
  });

  it('prevents direct cash from exceeding the balance reserved by submitted payments', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-15');
    invoice.submitPayment(
      80_00,
      PaymentMethod.CASH,
      null,
      undefined,
      NOW,
      IDEMPOTENCY_KEY,
      REQUEST_FINGERPRINT,
      SUBMITTER_ID,
    );

    expect(() =>
      invoice.settleCash(21_00, NOW, SECOND_IDEMPOTENCY_KEY, 'b'.repeat(64), SUBMITTER_ID),
    ).toThrow(InvoiceStateError);
  });

  it('moves SUBMITTED -> REJECTED without changing the approved amount', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-15');
    const payment = invoice.submitPayment(
      100_00,
      PaymentMethod.CASH,
      null,
      undefined,
      NOW,
      IDEMPOTENCY_KEY,
      REQUEST_FINGERPRINT,
      SUBMITTER_ID,
    );
    assignId(payment, 'd589dcf2-e1d1-4e2b-b132-d8458997097d');

    invoice.rejectPayment(
      payment.id,
      'Valor não recebido',
      new Date('2026-07-10T13:00:00.000Z'),
      REVIEWER_ID,
    );

    expect(payment.status).toBe(PaymentStatus.REJECTED);
    expect(payment.rejectionReason).toBe('Valor não recebido');
    expect(invoice.approvedAmountCents).toBe(0);
    expect(invoice.status).toBe(InvoiceStatus.OPEN);
  });

  it('supports approved partial payments until fully paid', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-15');
    const first = invoice.submitPayment(
      40_00,
      PaymentMethod.CASH,
      null,
      undefined,
      NOW,
      IDEMPOTENCY_KEY,
      REQUEST_FINGERPRINT,
      SUBMITTER_ID,
    );
    assignId(first, '070eb85e-5982-4b0b-a7c3-c7387bd3daf9');
    invoice.approvePayment(first.id, new Date('2026-07-10T13:00:00.000Z'), REVIEWER_ID);
    const second = invoice.submitPayment(
      60_00,
      PaymentMethod.PIX,
      ProofType.DIGITAL_SLIP,
      'proof/2',
      new Date('2026-07-11T12:00:00.000Z'),
      SECOND_IDEMPOTENCY_KEY,
      'b'.repeat(64),
      SUBMITTER_ID,
    );
    assignId(second, '223f6cc5-0db3-47ab-8cdf-101e23ac146f');
    expect(invoice.status).toBe(InvoiceStatus.UNDER_REVIEW);

    invoice.approvePayment(second.id, new Date('2026-07-11T13:00:00.000Z'), REVIEWER_ID);

    expect(invoice.status).toBe(InvoiceStatus.PAID);
    expect(invoice.outstandingAmountCents).toBe(0);
    expect(() =>
      invoice.submitPayment(
        1,
        PaymentMethod.CASH,
        null,
        undefined,
        NOW,
        'payment-attempt-0003',
        'c'.repeat(64),
        SUBMITTER_ID,
      ),
    ).toThrow(InvoiceStateError);
  });

  it('reserves submitted values and prevents overpayment before approval', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-15');
    invoice.submitPayment(
      80_00,
      PaymentMethod.CASH,
      null,
      undefined,
      NOW,
      IDEMPOTENCY_KEY,
      REQUEST_FINGERPRINT,
      SUBMITTER_ID,
    );

    expect(() =>
      invoice.submitPayment(
        20_01,
        PaymentMethod.CASH,
        null,
        undefined,
        NOW,
        SECOND_IDEMPOTENCY_KEY,
        'b'.repeat(64),
        SUBMITTER_ID,
      ),
    ).toThrow(InvoiceStateError);
  });

  it('releases a rejected reservation for a replacement payment', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-15');
    const rejected = submitCashPayment(invoice, 100_00);
    assignId(rejected, 'e1687aaa-1967-4f58-9aa1-227268df5899');
    invoice.rejectPayment(
      rejected.id,
      'Pagamento não localizado',
      new Date('2026-07-10T13:00:00.000Z'),
      REVIEWER_ID,
    );

    expect(() =>
      submitCashPayment(invoice, 100_00, SECOND_IDEMPOTENCY_KEY, 'b'.repeat(64)),
    ).not.toThrow();
    expect(invoice.status).toBe(InvoiceStatus.UNDER_REVIEW);
  });

  it('does not allow a reviewed payment to be reviewed again', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-15');
    const payment = invoice.submitPayment(
      25_00,
      PaymentMethod.CASH,
      null,
      undefined,
      NOW,
      IDEMPOTENCY_KEY,
      REQUEST_FINGERPRINT,
      SUBMITTER_ID,
    );
    assignId(payment, 'dc7da4da-dd69-4381-93a7-24f2896de197');
    invoice.approvePayment(payment.id, new Date('2026-07-10T13:00:00.000Z'), REVIEWER_ID);

    expect(() =>
      invoice.approvePayment(payment.id, new Date('2026-07-10T14:00:00.000Z'), REVIEWER_ID),
    ).toThrow(PaymentStateError);
  });

  it('rejects a repeated approval that would exceed the invoice total', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-15');
    const payment = submitCashPayment(invoice, 60_00);
    assignId(payment, '76b477d8-a311-4557-a739-fe0406f10f2a');
    invoice.approvePayment(payment.id, new Date('2026-07-10T13:00:00.000Z'), REVIEWER_ID);

    expect(() =>
      invoice.approvePayment(payment.id, new Date('2026-07-10T14:00:00.000Z'), REVIEWER_ID),
    ).toThrow(InvoiceStateError);
  });

  it('marks an unpaid invoice overdue after its due date', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-09');
    invoice.refreshStatus(NOW);
    expect(invoice.status).toBe(InvoiceStatus.OVERDUE);
  });

  it('usa a data civil informada sem antecipar o vencimento por UTC', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-12');
    invoice.refreshStatus('2026-07-12');
    expect(invoice.status).toBe(InvoiceStatus.OPEN);
    invoice.refreshStatus('2026-07-13');
    expect(invoice.status).toBe(InvoiceStatus.OVERDUE);
  });

  it('rejects an impossible civil status date without changing the current status', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-09');
    invoice.refreshStatus('2026-07-10');

    expect(() => invoice.refreshStatus('2026-02-30')).toThrow(ValidationError);
    expect(invoice.status).toBe(InvoiceStatus.OVERDUE);
  });

  it('accepts a valid leap day as a civil status date', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2028-02', 100_00, '2028-02-29');

    expect(() => invoice.refreshStatus('2028-02-29')).not.toThrow();
    expect(invoice.status).toBe(InvoiceStatus.OPEN);
  });

  it.each([
    ['a malformed string', '10/07/2026'],
    ['an invalid Date', new Date(Number.NaN)],
    ['a value of another type', 42 as unknown as string],
  ])('rejects %s as a status reference', (_scenario, asOf) => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-15');

    expect(() => invoice.refreshStatus(asOf)).toThrow(ValidationError);
  });

  it('rejects an invalid submission date atomically when the status date is omitted', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-15');

    const submit = (): PaymentTransaction =>
      invoice.submitPayment(
        25_00,
        PaymentMethod.CASH,
        null,
        undefined,
        new Date(Number.NaN),
        IDEMPOTENCY_KEY,
        REQUEST_FINGERPRINT,
        SUBMITTER_ID,
      );

    expect(submit).toThrow(ValidationError);
    expect(invoice.transactions).toHaveLength(0);
    expect(invoice.status).toBe(InvoiceStatus.OPEN);
    expect(invoice.approvedAmountCents).toBe(0);
    expect(invoice.outstandingAmountCents).toBe(100_00);
  });

  it('rejects an invalid explicit status date before appending the payment', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-15');

    expect(() =>
      invoice.submitPayment(
        25_00,
        PaymentMethod.CASH,
        null,
        undefined,
        NOW,
        IDEMPOTENCY_KEY,
        REQUEST_FINGERPRINT,
        SUBMITTER_ID,
        '2026-02-30',
      ),
    ).toThrow(ValidationError);
    expect(invoice.transactions).toHaveLength(0);
    expect(invoice.status).toBe(InvoiceStatus.OPEN);
    expect(invoice.approvedAmountCents).toBe(0);
    expect(invoice.outstandingAmountCents).toBe(100_00);
  });

  it('uses a valid submission date as the omitted status date and appends one transaction', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-15');

    const transaction = submitCashPayment(invoice, 25_00);

    expect(invoice.transactions).toEqual([transaction]);
    expect(invoice.status).toBe(InvoiceStatus.UNDER_REVIEW);
    expect(invoice.approvedAmountCents).toBe(0);
    expect(invoice.outstandingAmountCents).toBe(100_00);
  });

  it('requires proof for non-cash payments', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-15');
    expect(() =>
      invoice.submitPayment(
        10_00,
        PaymentMethod.PIX,
        null,
        undefined,
        NOW,
        IDEMPOTENCY_KEY,
        REQUEST_FINGERPRINT,
        SUBMITTER_ID,
      ),
    ).toThrow(ValidationError);
  });

  it('registra autores e impede o autor de revisar o próprio pagamento', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-15');
    const payment = invoice.submitPayment(
      25_00,
      PaymentMethod.CASH,
      null,
      undefined,
      NOW,
      IDEMPOTENCY_KEY,
      REQUEST_FINGERPRINT,
      SUBMITTER_ID,
    );
    assignId(payment, 'dad91a88-583f-4b2a-9ac6-0d8eb14cd266');

    expect(payment.submittedByUserId).toBe(SUBMITTER_ID);
    expect(() =>
      invoice.approvePayment(payment.id, new Date('2026-07-10T13:00:00.000Z'), SUBMITTER_ID),
    ).toThrow('O autor da submissão não pode revisar o próprio pagamento.');

    invoice.approvePayment(payment.id, new Date('2026-07-10T13:00:00.000Z'), REVIEWER_ID);
    expect(payment.reviewedByUserId).toBe(REVIEWER_ID);
  });

  it('finds a payment by idempotency key without inventing a missing match', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-15');
    const payment = submitCashPayment(invoice, 25_00);

    expect(invoice.findPaymentByIdempotencyKey(IDEMPOTENCY_KEY)).toBe(payment);
    expect(invoice.findPaymentByIdempotencyKey('payment-attempt-missing')).toBeUndefined();
  });

  it.each(['approve', 'reject'] as const)(
    'rejects an attempt to %s a payment from another invoice',
    (operation) => {
      const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-15');
      const reviewDate = new Date('2026-07-10T13:00:00.000Z');

      const review = (): PaymentTransaction =>
        operation === 'approve'
          ? invoice.approvePayment('missing-payment', reviewDate, REVIEWER_ID)
          : invoice.rejectPayment(
              'missing-payment',
              'Pagamento não localizado',
              reviewDate,
              REVIEWER_ID,
            );

      expect(review).toThrow(ValidationError);
    },
  );

  it.each([0, 10.5, Invoice.MAX_MONEY_CENTS + 1])(
    'rejects invalid submitted payment amount %s',
    (amountCents) => {
      const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-15');

      expect(() => submitCashPayment(invoice, amountCents)).toThrow(ValidationError);
    },
  );

  it.each([
    ['bad-id', '2026-07', 100, '2026-07-10'],
    [CONTRACT_ID, '07-2026', 100, '2026-07-10'],
    [CONTRACT_ID, '2026-07', 0, '2026-07-10'],
    [CONTRACT_ID, '2026-07', 100.5, '2026-07-10'],
    [CONTRACT_ID, '2026-07', Invoice.MAX_MONEY_CENTS + 1, '2026-07-10'],
    [CONTRACT_ID, '2026-07', 100, '10/07/2026'],
    [CONTRACT_ID, '2026-02', 100, '2026-02-30'],
    [CONTRACT_ID, '2026-07', 100, '2026-08-10'],
  ])(
    'rejects invalid invoice data with a DomainError',
    (contractId, competence, cents, dueDate) => {
      expect(() => Invoice.create(contractId, competence, cents, dueDate)).toThrow(ValidationError);
    },
  );
});
