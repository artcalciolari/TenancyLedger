import { ValidationError } from '../../../../core/domain/errors/validation.error';
import { Invoice, InvoiceStateError, InvoiceStatus } from './invoice.entity';
import {
  PaymentMethod,
  PaymentStateError,
  PaymentStatus,
  ProofType,
} from './payment-transaction.entity';

const CONTRACT_ID = 'a18175e8-a5b5-4f55-bd57-b5631a70b8f5';
const NOW = new Date('2026-07-10T12:00:00.000Z');
const IDEMPOTENCY_KEY = 'payment-attempt-0001';
const SECOND_IDEMPOTENCY_KEY = 'payment-attempt-0002';
const REQUEST_FINGERPRINT = 'a'.repeat(64);

function assignId(target: object, id: string): void {
  Object.defineProperty(target, 'id', { value: id, configurable: true });
}

describe('Invoice payment state machine', () => {
  it('creates an open invoice with an explicit competence', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 150_00, '2026-07-15');

    expect(invoice.status).toBe(InvoiceStatus.OPEN);
    expect(invoice.totalValueCents).toBe(150_00);
    expect(invoice.approvedAmountCents).toBe(0);
    expect(invoice.outstandingAmountCents).toBe(150_00);
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
    );
    assignId(payment, 'cb7b6dfd-b0c2-4414-a45a-a2cd467308f6');

    expect(payment.status).toBe(PaymentStatus.SUBMITTED);
    expect(invoice.status).toBe(InvoiceStatus.UNDER_REVIEW);
    expect(invoice.approvedAmountCents).toBe(0);

    invoice.approvePayment(payment.id, new Date('2026-07-10T13:00:00.000Z'));

    expect(payment.status).toBe(PaymentStatus.APPROVED);
    expect(invoice.approvedAmountCents).toBe(50_00);
    expect(invoice.outstandingAmountCents).toBe(100_00);
    expect(invoice.status).toBe(InvoiceStatus.PARTIALLY_PAID);
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
    );
    assignId(payment, 'd589dcf2-e1d1-4e2b-b132-d8458997097d');

    invoice.rejectPayment(payment.id, 'Valor não recebido', new Date('2026-07-10T13:00:00.000Z'));

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
    );
    assignId(first, '070eb85e-5982-4b0b-a7c3-c7387bd3daf9');
    invoice.approvePayment(first.id, new Date('2026-07-10T13:00:00.000Z'));
    const second = invoice.submitPayment(
      60_00,
      PaymentMethod.PIX,
      ProofType.DIGITAL_SLIP,
      'proof/2',
      new Date('2026-07-11T12:00:00.000Z'),
      SECOND_IDEMPOTENCY_KEY,
      'b'.repeat(64),
    );
    assignId(second, '223f6cc5-0db3-47ab-8cdf-101e23ac146f');
    invoice.approvePayment(second.id, new Date('2026-07-11T13:00:00.000Z'));

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
      ),
    ).toThrow(InvoiceStateError);
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
    );
    assignId(payment, 'dc7da4da-dd69-4381-93a7-24f2896de197');
    invoice.approvePayment(payment.id, new Date('2026-07-10T13:00:00.000Z'));

    expect(() => invoice.approvePayment(payment.id, new Date('2026-07-10T14:00:00.000Z'))).toThrow(
      PaymentStateError,
    );
  });

  it('marks an unpaid invoice overdue after its due date', () => {
    const invoice = Invoice.create(CONTRACT_ID, '2026-07', 100_00, '2026-07-09');
    invoice.refreshStatus(NOW);
    expect(invoice.status).toBe(InvoiceStatus.OVERDUE);
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
      ),
    ).toThrow(ValidationError);
  });

  it.each([
    ['bad-id', '2026-07', 100, '2026-07-10'],
    [CONTRACT_ID, '07-2026', 100, '2026-07-10'],
    [CONTRACT_ID, '2026-07', 0, '2026-07-10'],
    [CONTRACT_ID, '2026-07', 100.5, '2026-07-10'],
    [CONTRACT_ID, '2026-07', 100, '2026-08-10'],
  ])(
    'rejects invalid invoice data with a DomainError',
    (contractId, competence, cents, dueDate) => {
      expect(() => Invoice.create(contractId, competence, cents, dueDate)).toThrow(ValidationError);
    },
  );
});
