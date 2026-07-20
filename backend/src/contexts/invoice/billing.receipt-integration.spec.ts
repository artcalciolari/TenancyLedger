import { createHash } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type { StorageService } from '../../infrastructure/storage.service';
import { Contract, ContractStatus } from '../contract/domain/entities/contract.entity';
import type { ReceiptIssuerService } from '../receipt/application/receipt-issuer.service';
import { BillingService } from './billing.service';
import { Invoice } from './domain/entities/invoice.entity';
import {
  PaymentIdempotencyConflictError,
  PaymentMethod,
  type PaymentTransaction,
} from './domain/entities/payment-transaction.entity';
import type { IInvoiceRepository } from './domain/invoice.repository';
import type { Clock } from './infrastructure/workers/invoice-generation.worker';

const INVOICE_ID = '0a60a4ca-1a8e-4f0a-b0ee-2196db87ac51';
const CONTRACT_ID = '4d4d05b6-b5db-47c7-91fc-b0c86c036d9f';
const TENANT_ID = '48bb503a-4d2a-4f56-88eb-6f7a9436ec67';
const PROPERTY_ID = 'c2926b25-4e17-44a8-8097-9c093f842cbb';
const PAYMENT_ID = '283b10d3-58f2-42d8-aa93-777f55ec9476';
const SUBMITTER_ID = '4f59e471-f4d2-44f6-996f-547e83debc47';
const REVIEWER_ID = '957a3866-f282-48d7-9180-5cbf99c74982';
const IDEMPOTENCY_KEY = 'payment-attempt-0001';
const NOW = new Date('2026-07-18T15:30:00.000Z');
const RECEIPT_KEY = 'documents/receipts/df248760-6617-4dae-a7f2-3e80d7eac89a/document.pdf';

function assignId(target: object, id: string): void {
  Object.defineProperty(target, 'id', { value: id, configurable: true });
}

function createInvoice(): Invoice {
  const invoice = Invoice.create(
    CONTRACT_ID,
    '2026-07',
    100_00,
    '2026-07-20',
    '2026-07-18',
    '2026-08-17',
  );
  assignId(invoice, INVOICE_ID);
  return invoice;
}

describe('BillingService receipt transaction integration', () => {
  let invoice: Invoice;
  let manager: EntityManager;
  let managerSave: jest.Mock;
  let transactionalContractFind: jest.Mock;
  let updateWithLock: jest.MockedFunction<IInvoiceRepository['updateWithLock']>;
  let repository: IInvoiceRepository;
  let deleteObject: jest.Mock;
  let issue: jest.Mock;
  let voidForPayment: jest.Mock;
  let receiptIssuer: ReceiptIssuerService;
  let service: BillingService;

  beforeEach(() => {
    invoice = createInvoice();
    managerSave = jest.fn().mockImplementation((value: unknown) => {
      if (value instanceof Invoice) {
        const payment = value.transactions.at(-1);
        if (payment && !payment.id) assignId(payment, PAYMENT_ID);
      }
      return Promise.resolve(value);
    });
    transactionalContractFind = jest.fn().mockResolvedValue(null);
    manager = {
      save: managerSave,
      getRepository: jest.fn(() => ({ findOne: transactionalContractFind })),
    } as unknown as EntityManager;
    updateWithLock = jest
      .fn<
        ReturnType<IInvoiceRepository['updateWithLock']>,
        Parameters<IInvoiceRepository['updateWithLock']>
      >()
      .mockImplementation(async (_id, operation) => {
        await operation(invoice, manager);
        return invoice;
      });
    repository = {
      findById: jest.fn().mockResolvedValue(invoice),
      findByContractAndCompetence: jest.fn().mockResolvedValue(null),
      list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      insertIfAbsent: jest.fn().mockResolvedValue(true),
      updateWithLock,
      markOpenInvoicesOverdue: jest.fn().mockResolvedValue(0),
      listForExport: jest.fn().mockResolvedValue([]),
      listPaymentsForReview: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    deleteObject = jest.fn().mockResolvedValue(undefined);
    issue = jest.fn().mockResolvedValue({});
    voidForPayment = jest.fn().mockResolvedValue(undefined);
    receiptIssuer = { issue, voidForPayment } as unknown as ReceiptIssuerService;
    const clock: Clock = { now: jest.fn(() => new Date(NOW)) };
    service = new BillingService(
      repository,
      clock,
      { deleteObject } as unknown as StorageService,
      undefined,
      undefined,
      undefined,
      undefined,
      receiptIssuer,
    );
  });

  it('persists a direct payment id before issuing its receipt in the same manager', async () => {
    await service.settleCash(INVOICE_ID, {
      idempotencyKey: IDEMPOTENCY_KEY,
      amountCents: 100_00,
      settledByUserId: SUBMITTER_ID,
    });

    const payment = invoice.transactions.at(0);
    if (!payment) throw new Error('Expected the direct payment to be persisted.');
    const saveOrder = managerSave.mock.invocationCallOrder.at(0);
    const issueOrder = issue.mock.invocationCallOrder.at(0);
    if (saveOrder === undefined || issueOrder === undefined) {
      throw new Error('Expected payment persistence and receipt issuance calls.');
    }
    expect(payment.id).toBe(PAYMENT_ID);
    expect(managerSave).toHaveBeenCalledWith(invoice);
    expect(issue).toHaveBeenCalledWith(invoice, payment, manager, expect.any(Function));
    expect(saveOrder).toBeLessThan(issueOrder);
  });

  it('returns the same direct settlement for an identical idempotent retry', async () => {
    const input = {
      idempotencyKey: IDEMPOTENCY_KEY,
      amountCents: 100_00,
      settledByUserId: SUBMITTER_ID,
    };

    const first = await service.settleCash(INVOICE_ID, input);
    const second = await service.settleCash(INVOICE_ID, input);

    expect(second).toBe(first);
    expect(invoice.transactions).toHaveLength(1);
    expect(issue).toHaveBeenCalledTimes(1);
  });

  it('activates the initial contract under the same transaction and lock', async () => {
    const contract = Contract.createPendingSignature(TENANT_ID, PROPERTY_ID, '2026-07-18', 100_00);
    assignId(contract, CONTRACT_ID);
    contract.markSigned(new Date('2026-07-17T12:00:00.000Z'));
    transactionalContractFind.mockResolvedValue(contract);

    await service.settleCash(INVOICE_ID, {
      idempotencyKey: IDEMPOTENCY_KEY,
      amountCents: 100_00,
      settledByUserId: SUBMITTER_ID,
    });

    expect(transactionalContractFind.mock.calls).toContainEqual([
      {
        where: { id: CONTRACT_ID },
        lock: { mode: 'pessimistic_write' },
      },
    ]);
    expect(contract.status).toBe(ContractStatus.ACTIVE);
    expect(managerSave).toHaveBeenCalledWith(contract);
  });

  it('rolls settlement back before receipt upload when contract activation fails', async () => {
    const contract = Contract.createPendingSignature(TENANT_ID, PROPERTY_ID, '2026-07-18', 100_00);
    assignId(contract, CONTRACT_ID);
    contract.markSigned(new Date('2026-07-17T12:00:00.000Z'));
    transactionalContractFind.mockResolvedValue(contract);
    const activationError = new Error('contract save failed');
    managerSave.mockImplementation((value: unknown) => {
      if (value instanceof Invoice) {
        const payment = value.transactions.at(-1);
        if (payment && !payment.id) assignId(payment, PAYMENT_ID);
        return Promise.resolve(value);
      }
      return Promise.reject(activationError);
    });

    await expect(
      service.settleCash(INVOICE_ID, {
        idempotencyKey: IDEMPOTENCY_KEY,
        amountCents: 100_00,
        settledByUserId: SUBMITTER_ID,
      }),
    ).rejects.toBe(activationError);
    expect(issue).not.toHaveBeenCalled();
  });

  it('rejects a direct-settlement idempotency key reused with another amount', async () => {
    await service.settleCash(INVOICE_ID, {
      idempotencyKey: IDEMPOTENCY_KEY,
      amountCents: 100_00,
      settledByUserId: SUBMITTER_ID,
    });

    await expect(
      service.settleCash(INVOICE_ID, {
        idempotencyKey: IDEMPOTENCY_KEY,
        amountCents: 99_00,
        settledByUserId: SUBMITTER_ID,
      }),
    ).rejects.toBeInstanceOf(PaymentIdempotencyConflictError);
  });

  it('rejects a settlement key previously used by a non-direct payment', async () => {
    const settlementFingerprint = createHash('sha256')
      .update(JSON.stringify({ amountCents: 100_00, method: PaymentMethod.CASH }))
      .digest('hex');
    const payment = invoice.submitPayment(
      100_00,
      PaymentMethod.CASH,
      null,
      undefined,
      NOW,
      IDEMPOTENCY_KEY,
      settlementFingerprint,
      SUBMITTER_ID,
    );
    assignId(payment, PAYMENT_ID);

    await expect(
      service.settleCash(INVOICE_ID, {
        idempotencyKey: IDEMPOTENCY_KEY,
        amountCents: 100_00,
        settledByUserId: SUBMITTER_ID,
      }),
    ).rejects.toBeInstanceOf(PaymentIdempotencyConflictError);
  });

  it('issues a receipt when a submitted payment is approved', async () => {
    const payment = submitCashPayment();

    await service.approvePayment(INVOICE_ID, PAYMENT_ID, REVIEWER_ID);

    expect(issue).toHaveBeenCalledWith(invoice, payment, manager, expect.any(Function));
  });

  it('cleans an approval receipt object if the surrounding transaction fails', async () => {
    submitCashPayment();
    const transactionError = new Error('receipt row could not be saved');
    issue.mockImplementation(
      (
        _invoice: Invoice,
        _payment: PaymentTransaction,
        _manager: EntityManager,
        onStored?: (key: string) => void,
      ) => {
        onStored?.(RECEIPT_KEY);
        return Promise.reject(transactionError);
      },
    );

    await expect(service.approvePayment(INVOICE_ID, PAYMENT_ID, REVIEWER_ID)).rejects.toBe(
      transactionError,
    );
    expect(deleteObject).toHaveBeenCalledWith(RECEIPT_KEY);
  });

  it('voids the receipt when its approved payment is reversed', async () => {
    submitCashPayment();
    await service.approvePayment(INVOICE_ID, PAYMENT_ID, REVIEWER_ID);

    await service.reversePayment(INVOICE_ID, PAYMENT_ID, 'Lançamento incorreto', REVIEWER_ID);

    expect(voidForPayment).toHaveBeenCalledWith(PAYMENT_ID, 'Lançamento incorreto', NOW, manager);
  });

  it('propagates a receipt-voiding failure so payment reversal rolls back', async () => {
    submitCashPayment();
    await service.approvePayment(INVOICE_ID, PAYMENT_ID, REVIEWER_ID);
    const voidError = new Error('receipt could not be voided');
    voidForPayment.mockRejectedValue(voidError);

    await expect(
      service.reversePayment(INVOICE_ID, PAYMENT_ID, 'Lançamento incorreto', REVIEWER_ID),
    ).rejects.toBe(voidError);
  });

  it('deletes an orphaned receipt object if the transaction later fails', async () => {
    const transactionError = new Error('database commit failed');
    issue.mockImplementation(
      (
        _invoice: Invoice,
        _payment: PaymentTransaction,
        _manager: EntityManager,
        onStored?: (key: string) => void,
      ) => {
        onStored?.(RECEIPT_KEY);
        return Promise.reject(transactionError);
      },
    );

    await expect(
      service.settleCash(INVOICE_ID, {
        idempotencyKey: IDEMPOTENCY_KEY,
        amountCents: 100_00,
        settledByUserId: SUBMITTER_ID,
      }),
    ).rejects.toBe(transactionError);
    expect(deleteObject).toHaveBeenCalledWith(RECEIPT_KEY);
  });

  it('preserves the transaction error when orphan cleanup also fails', async () => {
    const transactionError = new Error('database commit failed');
    issue.mockImplementation(
      (
        _invoice: Invoice,
        _payment: PaymentTransaction,
        _manager: EntityManager,
        onStored?: (key: string) => void,
      ) => {
        onStored?.(RECEIPT_KEY);
        return Promise.reject(transactionError);
      },
    );
    deleteObject.mockRejectedValue(new Error('storage unavailable'));

    await expect(
      service.settleCash(INVOICE_ID, {
        idempotencyKey: IDEMPOTENCY_KEY,
        amountCents: 100_00,
        settledByUserId: SUBMITTER_ID,
      }),
    ).rejects.toBe(transactionError);
  });

  it('does not issue without a transactional entity manager', async () => {
    updateWithLock.mockImplementationOnce(async (_id, operation) => {
      await operation(invoice);
      return invoice;
    });

    await service.settleCash(INVOICE_ID, {
      idempotencyKey: IDEMPOTENCY_KEY,
      amountCents: 100_00,
      settledByUserId: SUBMITTER_ID,
    });

    expect(issue).not.toHaveBeenCalled();
  });

  function submitCashPayment(): PaymentTransaction {
    const payment = invoice.submitPayment(
      100_00,
      PaymentMethod.CASH,
      null,
      undefined,
      NOW,
      IDEMPOTENCY_KEY,
      'a'.repeat(64),
      SUBMITTER_ID,
    );
    assignId(payment, PAYMENT_ID);
    return payment;
  }
});
