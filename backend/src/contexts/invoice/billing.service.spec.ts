import { NotFoundException } from '@nestjs/common';
import { ValidationError } from '../../core/domain/errors/validation.error';
import type { StorageService } from '../../infrastructure/storage.service';
import { BillingService } from './billing.service';
import { Invoice, InvoiceStateError } from './domain/entities/invoice.entity';
import { PaymentMethod, ProofType } from './domain/entities/payment-transaction.entity';
import type { IInvoiceRepository, InvoiceListResult } from './domain/invoice.repository';
import type { Clock } from './infrastructure/workers/invoice-generation.worker';

const INVOICE_ID = '0a60a4ca-1a8e-4f0a-b0ee-2196db87ac51';
const CONTRACT_ID = '4d4d05b6-b5db-47c7-91fc-b0c86c036d9f';
const PAYMENT_ID = '283b10d3-58f2-42d8-aa93-777f55ec9476';
const NOW = new Date('2026-07-12T15:00:00.000Z');
const IDEMPOTENCY_KEY = 'payment-attempt-0001';
const REQUEST_FINGERPRINT = 'a'.repeat(64);
const STORED_KEY = `payment-proofs/${INVOICE_ID}/ea055cde-36d4-42f7-8412-f2b74fa5d1be.pdf`;

function assignId(target: object, id: string): void {
  Object.defineProperty(target, 'id', { value: id, configurable: true });
}

function createInvoice(totalValueCents = 100_00): Invoice {
  const invoice = Invoice.create(CONTRACT_ID, '2026-07', totalValueCents, '2026-07-20');
  assignId(invoice, INVOICE_ID);
  return invoice;
}

type RepositoryMock = jest.Mocked<IInvoiceRepository>;
type StorageMock = jest.Mocked<
  Pick<StorageService, 'uploadPaymentProof' | 'deleteObject' | 'createReadUrl'>
>;

describe('BillingService', () => {
  let invoice: Invoice;
  let repository: RepositoryMock;
  let clock: Clock;
  let storage: StorageMock;
  let service: BillingService;
  let updateWithLock: jest.MockedFunction<IInvoiceRepository['updateWithLock']>;
  let uploadPaymentProof: StorageMock['uploadPaymentProof'];
  let deleteObject: StorageMock['deleteObject'];
  let createReadUrl: StorageMock['createReadUrl'];

  beforeEach(() => {
    invoice = createInvoice();
    updateWithLock = jest
      .fn<
        ReturnType<IInvoiceRepository['updateWithLock']>,
        Parameters<IInvoiceRepository['updateWithLock']>
      >()
      .mockImplementation(async (_id, update) => {
        await update(invoice);
        const payment = invoice.transactions.at(-1);
        if (payment && !payment.id) assignId(payment, PAYMENT_ID);
        return invoice;
      });
    repository = {
      findById: jest.fn().mockResolvedValue(invoice),
      findByContractAndCompetence: jest.fn().mockResolvedValue(null),
      list: jest
        .fn<Promise<InvoiceListResult>, Parameters<IInvoiceRepository['list']>>()
        .mockResolvedValue({ items: [], total: 0 }),
      insertIfAbsent: jest.fn().mockResolvedValue(true),
      updateWithLock,
      markOpenInvoicesOverdue: jest.fn().mockResolvedValue(0),
    };
    clock = { now: jest.fn(() => new Date(NOW)) };
    uploadPaymentProof = jest.fn().mockResolvedValue({ bucket: 'private-bucket', key: STORED_KEY });
    deleteObject = jest.fn().mockResolvedValue(undefined);
    createReadUrl = jest.fn().mockResolvedValue('https://storage.example/signed-proof');
    storage = {
      uploadPaymentProof,
      deleteObject,
      createReadUrl,
    };
    service = new BillingService(repository, clock, storage as unknown as StorageService);
  });

  describe('submitPayment', () => {
    it('submits a CASH payment without a proof', async () => {
      const result = await service.submitPayment(INVOICE_ID, {
        idempotencyKey: IDEMPOTENCY_KEY,
        amountCents: 25_00,
        method: PaymentMethod.CASH,
        proofType: null,
      });

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        amountCents: 25_00,
        method: PaymentMethod.CASH,
        proofReference: null,
      });
      expect(updateWithLock).toHaveBeenCalledWith(
        INVOICE_ID,
        expect.any(Function),
        IDEMPOTENCY_KEY,
      );
      expect(uploadPaymentProof).not.toHaveBeenCalled();
    });

    it('rejects a CASH payment that includes a digital proof', async () => {
      await expect(
        service.submitPayment(INVOICE_ID, {
          idempotencyKey: IDEMPOTENCY_KEY,
          amountCents: 25_00,
          method: PaymentMethod.CASH,
          proofType: null,
          proof: {
            originalName: 'cash.pdf',
            contentType: 'application/pdf',
            body: Buffer.from('%PDF-1.7\ncash'),
          },
        }),
      ).rejects.toThrow(
        new ValidationError('Pagamentos em dinheiro não devem enviar comprovante digital.'),
      );

      expect(uploadPaymentProof).not.toHaveBeenCalled();
      expect(updateWithLock).not.toHaveBeenCalled();
    });

    it.each([PaymentMethod.PIX, PaymentMethod.BANK_TRANSFER])(
      'requires a proof for a %s payment',
      async (method) => {
        await expect(
          service.submitPayment(INVOICE_ID, {
            idempotencyKey: IDEMPOTENCY_KEY,
            amountCents: 25_00,
            method,
            proofType: ProofType.BANK_STATEMENT,
          }),
        ).rejects.toThrow(
          new ValidationError('Pagamentos não realizados em dinheiro exigem um comprovante.'),
        );

        expect(uploadPaymentProof).not.toHaveBeenCalled();
        expect(updateWithLock).not.toHaveBeenCalled();
      },
    );

    it('uploads the proof and persists only the generated object key', async () => {
      const body = Buffer.from('%PDF-1.7\npayment');

      const result = await service.submitPayment(INVOICE_ID, {
        idempotencyKey: IDEMPOTENCY_KEY,
        amountCents: 25_00,
        method: PaymentMethod.PIX,
        proofType: ProofType.DIGITAL_SLIP,
        proof: {
          originalName: 'bank-statement.pdf',
          contentType: 'application/pdf',
          body,
        },
      });

      expect(uploadPaymentProof).toHaveBeenCalledWith({
        invoiceId: INVOICE_ID,
        originalName: 'bank-statement.pdf',
        contentType: 'application/pdf',
        body,
      });
      expect(result.transactions[0]?.proofReference).toBe(STORED_KEY);
      expect(result.transactions[0]?.proofReference).not.toContain('bank-statement.pdf');
      expect(result.transactions[0]?.proofReference).not.toContain('private-bucket');
    });

    it('deletes an uploaded proof when the domain rejects the payment', async () => {
      await expect(
        service.submitPayment(INVOICE_ID, {
          idempotencyKey: IDEMPOTENCY_KEY,
          amountCents: 100_01,
          method: PaymentMethod.PIX,
          proofType: ProofType.DIGITAL_SLIP,
          proof: {
            originalName: 'proof.pdf',
            contentType: 'application/pdf',
            body: Buffer.from('%PDF-1.7\nproof'),
          },
        }),
      ).rejects.toThrow(InvoiceStateError);

      expect(deleteObject).toHaveBeenCalledWith(STORED_KEY);
    });

    it('deletes an uploaded proof when persistence fails', async () => {
      const databaseError = new Error('database unavailable');
      updateWithLock.mockImplementationOnce(async (_id, update) => {
        await update(invoice);
        throw databaseError;
      });

      await expect(
        service.submitPayment(INVOICE_ID, {
          idempotencyKey: IDEMPOTENCY_KEY,
          amountCents: 25_00,
          method: PaymentMethod.PIX,
          proofType: ProofType.DIGITAL_SLIP,
          proof: {
            originalName: 'proof.pdf',
            contentType: 'application/pdf',
            body: Buffer.from('%PDF-1.7\nproof'),
          },
        }),
      ).rejects.toBe(databaseError);

      expect(deleteObject).toHaveBeenCalledWith(STORED_KEY);
    });

    it('returns the existing payment for an exact retry without uploading another proof', async () => {
      const input = {
        idempotencyKey: IDEMPOTENCY_KEY,
        amountCents: 25_00,
        method: PaymentMethod.PIX,
        proofType: ProofType.DIGITAL_SLIP,
        proof: {
          originalName: 'proof.pdf',
          contentType: 'application/pdf',
          body: Buffer.from('%PDF-1.7\nproof'),
        },
      } as const;

      const first = await service.submitPayment(INVOICE_ID, input);
      const second = await service.submitPayment(INVOICE_ID, input);

      expect(first.transactions).toHaveLength(1);
      expect(second.transactions).toHaveLength(1);
      expect(second.transactions[0]?.id).toBe(PAYMENT_ID);
      expect(uploadPaymentProof).toHaveBeenCalledTimes(1);
      expect(updateWithLock).toHaveBeenCalledTimes(2);
    });

    it('rejects reuse of a key with different data before uploading another proof', async () => {
      const proof = {
        originalName: 'proof.pdf',
        contentType: 'application/pdf',
        body: Buffer.from('%PDF-1.7\nproof'),
      };
      await service.submitPayment(INVOICE_ID, {
        idempotencyKey: IDEMPOTENCY_KEY,
        amountCents: 25_00,
        method: PaymentMethod.PIX,
        proofType: ProofType.DIGITAL_SLIP,
        proof,
      });

      await expect(
        service.submitPayment(INVOICE_ID, {
          idempotencyKey: IDEMPOTENCY_KEY,
          amountCents: 20_00,
          method: PaymentMethod.PIX,
          proofType: ProofType.DIGITAL_SLIP,
          proof,
        }),
      ).rejects.toThrow('A Idempotency-Key já foi usada nesta fatura com dados diferentes.');

      expect(invoice.transactions).toHaveLength(1);
      expect(uploadPaymentProof).toHaveBeenCalledTimes(1);
    });

    it('rejects a missing idempotency key before locking or uploading', async () => {
      await expect(
        service.submitPayment(INVOICE_ID, {
          amountCents: 25_00,
          method: PaymentMethod.PIX,
          proofType: ProofType.DIGITAL_SLIP,
          proof: {
            originalName: 'proof.pdf',
            contentType: 'application/pdf',
            body: Buffer.from('%PDF-1.7\nproof'),
          },
        }),
      ).rejects.toThrow('O header Idempotency-Key deve conter de 8 a 128 caracteres');

      expect(updateWithLock).not.toHaveBeenCalled();
      expect(uploadPaymentProof).not.toHaveBeenCalled();
    });
  });

  describe('views', () => {
    it('exposes hasProof without leaking proofReference', () => {
      const payment = invoice.submitPayment(
        25_00,
        PaymentMethod.PIX,
        ProofType.DIGITAL_SLIP,
        STORED_KEY,
        NOW,
        IDEMPOTENCY_KEY,
        REQUEST_FINGERPRINT,
      );
      assignId(payment, PAYMENT_ID);

      const view = BillingService.toView(invoice);
      const serializedPayment = JSON.parse(JSON.stringify(view.payments[0])) as Record<
        string,
        unknown
      >;

      expect(serializedPayment).toMatchObject({ id: PAYMENT_ID, hasProof: true });
      expect(serializedPayment).not.toHaveProperty('proofReference');
      expect(JSON.stringify(view)).not.toContain(STORED_KEY);
    });
  });

  describe('getPaymentProofUrl', () => {
    it('rejects a payment that does not belong to the invoice', async () => {
      await expect(service.getPaymentProofUrl(INVOICE_ID, PAYMENT_ID)).rejects.toThrow(
        new NotFoundException('Pagamento não encontrado.'),
      );

      expect(createReadUrl).not.toHaveBeenCalled();
    });

    it('rejects a payment without a digital proof', async () => {
      const payment = invoice.submitPayment(
        25_00,
        PaymentMethod.CASH,
        null,
        undefined,
        NOW,
        IDEMPOTENCY_KEY,
        REQUEST_FINGERPRINT,
      );
      assignId(payment, PAYMENT_ID);

      await expect(service.getPaymentProofUrl(INVOICE_ID, PAYMENT_ID)).rejects.toThrow(
        new NotFoundException('Este pagamento não possui comprovante digital.'),
      );

      expect(createReadUrl).not.toHaveBeenCalled();
    });

    it('presigns the proof belonging to the invoice for 300 seconds', async () => {
      const payment = invoice.submitPayment(
        25_00,
        PaymentMethod.PIX,
        ProofType.DIGITAL_SLIP,
        STORED_KEY,
        NOW,
        IDEMPOTENCY_KEY,
        REQUEST_FINGERPRINT,
      );
      assignId(payment, PAYMENT_ID);

      await expect(service.getPaymentProofUrl(INVOICE_ID, PAYMENT_ID)).resolves.toEqual({
        url: 'https://storage.example/signed-proof',
        expiresInSeconds: 300,
      });
      expect(createReadUrl).toHaveBeenCalledWith(STORED_KEY, 300);
    });
  });
});
