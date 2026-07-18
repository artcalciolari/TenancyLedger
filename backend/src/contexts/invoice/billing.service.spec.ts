import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { ValidationError } from '../../core/domain/errors/validation.error';
import type { StorageService } from '../../infrastructure/storage.service';
import { BillingService } from './billing.service';
import { Invoice, InvoiceStateError, InvoiceStatus } from './domain/entities/invoice.entity';
import {
  PaymentMethod,
  PaymentStatus,
  ProofType,
} from './domain/entities/payment-transaction.entity';
import type { IInvoiceRepository, InvoiceListResult } from './domain/invoice.repository';
import type { Clock } from './infrastructure/workers/invoice-generation.worker';
import { Contract, ContractStatus } from '../contract/domain/entities/contract.entity';
import { Tenant, TenantCivilStatus } from '../tenant/domain/entities/tenant.entity';
import { PropertyUnit, UnitType } from '../property/domain/property-unit.entity';
import type { Repository } from 'typeorm';

const INVOICE_ID = '0a60a4ca-1a8e-4f0a-b0ee-2196db87ac51';
const CONTRACT_ID = '4d4d05b6-b5db-47c7-91fc-b0c86c036d9f';
const SECOND_INVOICE_ID = '3112bf50-78f9-4bbb-b781-ad324addc19b';
const SECOND_CONTRACT_ID = '80e7dd97-eb89-4a3c-bfcf-e5669e560c06';
const TENANT_ID = '48bb503a-4d2a-4f56-88eb-6f7a9436ec67';
const SECOND_TENANT_ID = '15821999-f689-46d2-b2e7-ce1aef5a6ebf';
const PROPERTY_ID = 'c2926b25-4e17-44a8-8097-9c093f842cbb';
const SECOND_PROPERTY_ID = 'b3309ca5-a4ef-4575-a627-60d2ad635aee';
const PAYMENT_ID = '283b10d3-58f2-42d8-aa93-777f55ec9476';
const NOW = new Date('2026-07-12T15:00:00.000Z');
const IDEMPOTENCY_KEY = 'payment-attempt-0001';
const SUBMITTER_ID = '4f59e471-f4d2-44f6-996f-547e83debc47';
const REVIEWER_ID = '957a3866-f282-48d7-9180-5cbf99c74982';
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

function relationRepositories(
  overrides: {
    contracts?: Contract[];
    tenants?: Tenant[];
    properties?: PropertyUnit[];
  } = {},
): {
  contracts: jest.Mocked<Pick<Repository<Contract>, 'findBy'>>;
  tenants: jest.Mocked<Pick<Repository<Tenant>, 'findBy'>>;
  properties: jest.Mocked<Pick<Repository<PropertyUnit>, 'findBy'>>;
} {
  const contracts = {
    findBy: jest.fn().mockResolvedValue(
      overrides.contracts ?? [
        {
          id: CONTRACT_ID,
          tenantId: TENANT_ID,
          propertyUnitId: PROPERTY_ID,
          status: ContractStatus.ACTIVE,
          endDate: '2027-06-30',
        } as Contract,
      ],
    ),
  };
  const tenants = {
    findBy: jest.fn().mockResolvedValue(
      overrides.tenants ?? [
        {
          id: TENANT_ID,
          name: 'Maria da Silva',
          cpf: '52998224725',
          profession: 'Engenheira',
          civilStatus: TenantCivilStatus.SINGLE,
          email: 'maria@example.com',
          mobilePhone: '11987654321',
        } as Tenant,
      ],
    ),
  };
  const properties = {
    findBy: jest.fn().mockResolvedValue(
      overrides.properties ?? [
        {
          id: PROPERTY_ID,
          neighborhood: 'Centro',
          type: UnitType.APARTMENT,
          unitNumber: '101-A',
        } as PropertyUnit,
      ],
    ),
  };
  return { contracts, tenants, properties };
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
      listForExport: jest.fn().mockResolvedValue([]),
      listPaymentsForReview: jest.fn().mockResolvedValue({ items: [], total: 0 }),
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
        submittedByUserId: SUBMITTER_ID,
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

    it.each([
      ['zero', 0],
      ['a fractional cent', 25.5],
      ['above the database money limit', Invoice.MAX_MONEY_CENTS + 1],
    ])(
      'rejects %s instead of rounding an invalid monetary amount',
      async (_description, amountCents) => {
        await expect(
          service.submitPayment(INVOICE_ID, {
            idempotencyKey: IDEMPOTENCY_KEY,
            submittedByUserId: SUBMITTER_ID,
            amountCents,
            method: PaymentMethod.CASH,
            proofType: null,
          }),
        ).rejects.toThrow(
          new ValidationError(
            'O valor do pagamento em centavos deve ser um inteiro positivo seguro.',
          ),
        );

        expect(invoice.transactions).toHaveLength(0);
        expect(uploadPaymentProof).not.toHaveBeenCalled();
      },
    );

    it('rejects a CASH payment that includes a digital proof', async () => {
      await expect(
        service.submitPayment(INVOICE_ID, {
          idempotencyKey: IDEMPOTENCY_KEY,
          submittedByUserId: SUBMITTER_ID,
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
            submittedByUserId: SUBMITTER_ID,
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
        submittedByUserId: SUBMITTER_ID,
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
          submittedByUserId: SUBMITTER_ID,
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
          submittedByUserId: SUBMITTER_ID,
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

    it('preserves the persistence failure when orphan cleanup also fails', async () => {
      const databaseError = new Error('database unavailable');
      const cleanupError = new Error('storage unavailable');
      const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      updateWithLock.mockImplementationOnce(async (_id, update) => {
        await update(invoice);
        throw databaseError;
      });
      deleteObject.mockRejectedValueOnce(cleanupError);

      await expect(
        service.submitPayment(INVOICE_ID, {
          idempotencyKey: IDEMPOTENCY_KEY,
          submittedByUserId: SUBMITTER_ID,
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
      expect(logError).toHaveBeenCalledWith(
        'Could not remove an orphaned payment proof',
        cleanupError.stack,
      );
    });

    it('reports an invoice missing under lock without retaining a proof', async () => {
      updateWithLock.mockResolvedValueOnce(null);

      await expect(
        service.submitPayment(INVOICE_ID, {
          idempotencyKey: IDEMPOTENCY_KEY,
          submittedByUserId: SUBMITTER_ID,
          amountCents: 25_00,
          method: PaymentMethod.CASH,
          proofType: null,
        }),
      ).rejects.toEqual(new NotFoundException('Fatura não encontrada.'));

      expect(uploadPaymentProof).not.toHaveBeenCalled();
      expect(deleteObject).not.toHaveBeenCalled();
    });

    it('returns the existing payment for an exact retry without uploading another proof', async () => {
      const input = {
        idempotencyKey: IDEMPOTENCY_KEY,
        submittedByUserId: SUBMITTER_ID,
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
        submittedByUserId: SUBMITTER_ID,
        amountCents: 25_00,
        method: PaymentMethod.PIX,
        proofType: ProofType.DIGITAL_SLIP,
        proof,
      });

      await expect(
        service.submitPayment(INVOICE_ID, {
          idempotencyKey: IDEMPOTENCY_KEY,
          submittedByUserId: SUBMITTER_ID,
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
          submittedByUserId: SUBMITTER_ID,
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

  describe('payment review state', () => {
    it('approves a partial payment and exposes the exact outstanding balance', async () => {
      await service.submitPayment(INVOICE_ID, {
        idempotencyKey: IDEMPOTENCY_KEY,
        submittedByUserId: SUBMITTER_ID,
        amountCents: 25_00,
        method: PaymentMethod.CASH,
        proofType: null,
      });

      const result = await service.approvePayment(INVOICE_ID, PAYMENT_ID, REVIEWER_ID);

      expect(result).toMatchObject({
        status: InvoiceStatus.PARTIALLY_PAID,
        approvedAmountCents: 25_00,
        outstandingAmountCents: 75_00,
      });
      expect(result.transactions[0]).toMatchObject({
        status: PaymentStatus.APPROVED,
        reviewedByUserId: REVIEWER_ID,
      });
    });

    it('quits the invoice exactly and rejects a later payment in the paid state', async () => {
      await service.submitPayment(INVOICE_ID, {
        idempotencyKey: IDEMPOTENCY_KEY,
        submittedByUserId: SUBMITTER_ID,
        amountCents: 100_00,
        method: PaymentMethod.CASH,
        proofType: null,
      });

      const paid = await service.approvePayment(INVOICE_ID, PAYMENT_ID, REVIEWER_ID);
      expect(paid).toMatchObject({
        status: InvoiceStatus.PAID,
        approvedAmountCents: 100_00,
        outstandingAmountCents: 0,
      });

      await expect(
        service.submitPayment(INVOICE_ID, {
          idempotencyKey: 'payment-attempt-0002',
          submittedByUserId: SUBMITTER_ID,
          amountCents: 1,
          method: PaymentMethod.CASH,
          proofType: null,
        }),
      ).rejects.toThrow(
        new InvoiceStateError('Não é possível adicionar pagamentos a uma fatura já quitada.'),
      );
    });

    it('reopens the full balance after a submitted payment is rejected', async () => {
      await service.submitPayment(INVOICE_ID, {
        idempotencyKey: IDEMPOTENCY_KEY,
        submittedByUserId: SUBMITTER_ID,
        amountCents: 25_00,
        method: PaymentMethod.CASH,
        proofType: null,
      });

      const result = await service.rejectPayment(
        INVOICE_ID,
        PAYMENT_ID,
        'Comprovante ilegível',
        REVIEWER_ID,
      );

      expect(result).toMatchObject({
        status: InvoiceStatus.OPEN,
        approvedAmountCents: 0,
        outstandingAmountCents: 100_00,
      });
      expect(result.transactions[0]).toMatchObject({
        status: PaymentStatus.REJECTED,
        rejectionReason: 'Comprovante ilegível',
      });
    });

    it('reports a missing invoice during approval', async () => {
      updateWithLock.mockResolvedValueOnce(null);

      await expect(service.approvePayment(INVOICE_ID, PAYMENT_ID, REVIEWER_ID)).rejects.toEqual(
        new NotFoundException('Fatura não encontrada.'),
      );
    });

    it('reports a missing invoice during rejection', async () => {
      updateWithLock.mockResolvedValueOnce(null);

      await expect(
        service.rejectPayment(INVOICE_ID, PAYMENT_ID, 'Motivo', REVIEWER_ID),
      ).rejects.toEqual(new NotFoundException('Fatura não encontrada.'));
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
        SUBMITTER_ID,
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

  describe('invoice relationship views', () => {
    it('monta a visão detalhada de uma fatura com suas relações públicas', async () => {
      const relations = relationRepositories();
      const relationalService = new BillingService(
        repository,
        clock,
        storage as unknown as StorageService,
        relations.contracts as unknown as Repository<Contract>,
        relations.tenants as unknown as Repository<Tenant>,
        relations.properties as unknown as Repository<PropertyUnit>,
      );

      await expect(relationalService.toDetailedView(invoice)).resolves.toMatchObject({
        id: INVOICE_ID,
        approvedAmountCents: 0,
        outstandingAmountCents: 100_00,
        contract: {
          id: CONTRACT_ID,
          tenant: { name: 'Maria da Silva', cpf: '***.***.***-25' },
          propertyUnit: { id: PROPERTY_ID, neighborhood: 'Centro', unitNumber: '101-A' },
        },
      });
      expect(relations.contracts.findBy).toHaveBeenCalledTimes(1);
      expect(relations.tenants.findBy).toHaveBeenCalledTimes(1);
      expect(relations.properties.findBy).toHaveBeenCalledTimes(1);
    });

    it('lists invoice balances with an expired effective contract status', async () => {
      repository.list.mockResolvedValue({ items: [invoice], total: 1 });
      const relations = relationRepositories({
        contracts: [
          {
            id: CONTRACT_ID,
            tenantId: TENANT_ID,
            propertyUnitId: PROPERTY_ID,
            status: ContractStatus.ACTIVE,
            endDate: '2026-07-11',
          } as Contract,
        ],
      });
      const relationalService = new BillingService(
        repository,
        clock,
        storage as unknown as StorageService,
        relations.contracts as unknown as Repository<Contract>,
        relations.tenants as unknown as Repository<Tenant>,
        relations.properties as unknown as Repository<PropertyUnit>,
      );

      await expect(relationalService.list({ page: 1, limit: 20 })).resolves.toMatchObject({
        data: [
          {
            id: INVOICE_ID,
            approvedAmountCents: 0,
            outstandingAmountCents: 100_00,
            contract: {
              id: CONTRACT_ID,
              status: ContractStatus.EXPIRED,
              tenant: { name: 'Maria da Silva', cpf: '***.***.***-25' },
              propertyUnit: { id: PROPERTY_ID, neighborhood: 'Centro', unitNumber: '101-A' },
            },
          },
        ],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    });

    it('fails explicitly when relational repositories are unavailable', async () => {
      repository.list.mockResolvedValue({ items: [invoice], total: 1 });

      await expect(service.list({ page: 1, limit: 20 })).rejects.toEqual(
        new NotFoundException('Relacionamentos da fatura não encontrados.'),
      );
    });

    it('does not query unrelated tables when no contract is found', async () => {
      repository.list.mockResolvedValue({ items: [invoice], total: 1 });
      const relations = relationRepositories({ contracts: [] });
      const relationalService = new BillingService(
        repository,
        clock,
        storage as unknown as StorageService,
        relations.contracts as unknown as Repository<Contract>,
        relations.tenants as unknown as Repository<Tenant>,
        relations.properties as unknown as Repository<PropertyUnit>,
      );

      await expect(relationalService.list({ page: 1, limit: 20 })).rejects.toEqual(
        new NotFoundException('Relacionamentos da fatura não encontrados.'),
      );
      expect(relations.tenants.findBy).not.toHaveBeenCalled();
      expect(relations.properties.findBy).not.toHaveBeenCalled();
    });

    it('does not expose a partial relationship when the tenant is missing', async () => {
      repository.list.mockResolvedValue({ items: [invoice], total: 1 });
      const relations = relationRepositories({ tenants: [] });
      const relationalService = new BillingService(
        repository,
        clock,
        storage as unknown as StorageService,
        relations.contracts as unknown as Repository<Contract>,
        relations.tenants as unknown as Repository<Tenant>,
        relations.properties as unknown as Repository<PropertyUnit>,
      );

      await expect(relationalService.list({ page: 1, limit: 20 })).rejects.toEqual(
        new NotFoundException('Relacionamentos da fatura não encontrados.'),
      );
    });
  });

  describe('exportCsv', () => {
    it('keeps relational columns empty when optional context is unavailable', async () => {
      repository.listForExport.mockResolvedValue([invoice]);

      const csv = await service.exportCsv({ page: 1, limit: 20 });
      const row = csv.split('\r\n')[1]?.split(',') ?? [];

      expect(row.slice(0, 8)).toEqual([
        INVOICE_ID,
        '2026-07',
        '2026-07-20',
        InvoiceStatus.OPEN,
        '10000',
        '0',
        '10000',
        CONTRACT_ID,
      ]);
      expect(row.slice(8)).toEqual(['', '', '', '', '', '']);
    });

    it('neutralizes =, +, -, and @ formula prefixes in exported invoice cells', async () => {
      const secondInvoice = Invoice.create(SECOND_CONTRACT_ID, '2026-08', 200_00, '2026-08-20');
      assignId(secondInvoice, SECOND_INVOICE_ID);
      repository.listForExport.mockResolvedValue([invoice, secondInvoice]);

      const contracts = {
        findBy: jest.fn().mockResolvedValue([
          {
            id: CONTRACT_ID,
            tenantId: TENANT_ID,
            propertyUnitId: PROPERTY_ID,
            status: ContractStatus.ACTIVE,
            endDate: '2027-06-30',
          } as Contract,
          {
            id: SECOND_CONTRACT_ID,
            tenantId: SECOND_TENANT_ID,
            propertyUnitId: SECOND_PROPERTY_ID,
            status: ContractStatus.ACTIVE,
            endDate: '2027-07-31',
          } as Contract,
        ]),
      } as unknown as Repository<Contract>;
      const tenants = {
        findBy: jest.fn().mockResolvedValue([
          {
            id: TENANT_ID,
            name: 'Primeiro Tenant',
            cpf: '12345678909',
            profession: 'Engenheiro civil',
            civilStatus: TenantCivilStatus.SINGLE,
            email: 'primeiro@example.com',
            mobilePhone: '11999999999',
          } as Tenant,
          {
            id: SECOND_TENANT_ID,
            name: 'Segunda Tenant',
            cpf: '52998224725',
            profession: 'Arquiteta',
            civilStatus: TenantCivilStatus.SINGLE,
            email: 'segunda@example.com',
            mobilePhone: '11988888888',
          } as Tenant,
        ]),
      } as unknown as Repository<Tenant>;
      const properties = {
        findBy: jest.fn().mockResolvedValue([
          {
            id: PROPERTY_ID,
            neighborhood: '=1+1',
            type: UnitType.APARTMENT,
            unitNumber: '+SUM(A1:A2)',
          } as PropertyUnit,
          {
            id: SECOND_PROPERTY_ID,
            neighborhood: '-2+3',
            type: UnitType.HOUSE,
            unitNumber: '@SUM(A1:A2)',
          } as PropertyUnit,
        ]),
      } as unknown as Repository<PropertyUnit>;
      const exportService = new BillingService(
        repository,
        clock,
        storage as unknown as StorageService,
        contracts,
        tenants,
        properties,
      );

      const csv = await exportService.exportCsv({ page: 1, limit: 20 });
      const cells = csv
        .split('\r\n')
        .slice(1)
        .flatMap((row) => row.split(','));

      expect(cells).toEqual(
        expect.arrayContaining(["'=1+1", "'+SUM(A1:A2)", "'-2+3", "'@SUM(A1:A2)"]),
      );
    });
  });

  describe('payment review queries', () => {
    it('returns submitted payments paginated with masked relational context', async () => {
      repository.listPaymentsForReview.mockResolvedValue({
        total: 21,
        items: [
          {
            paymentId: PAYMENT_ID,
            amountCents: 25_00,
            submittedAt: NOW,
            method: PaymentMethod.PIX,
            proofType: ProofType.DIGITAL_SLIP,
            hasProof: true,
            status: PaymentStatus.SUBMITTED,
            reviewedAt: null,
            rejectionReason: null,
            submittedByUserId: SUBMITTER_ID,
            reviewedByUserId: null,
            invoiceId: INVOICE_ID,
            competence: '2026-07',
            dueDate: '2026-07-20',
            invoiceStatus: InvoiceStatus.UNDER_REVIEW,
            totalValueCents: 100_00,
            approvedAmountCents: 0,
            outstandingAmountCents: 100_00,
            contractId: CONTRACT_ID,
            contractStatus: ContractStatus.ACTIVE,
            contractEndDate: '2027-06-30',
            tenantId: '48bb503a-4d2a-4f56-88eb-6f7a9436ec67',
            tenantName: 'Maria da Silva',
            tenantCpf: '52998224725',
            tenantProfession: 'Engenheira',
            tenantCivilStatus: TenantCivilStatus.SINGLE,
            tenantEmail: 'maria@example.com',
            tenantMobilePhone: '11987654321',
            propertyUnitId: 'c2926b25-4e17-44a8-8097-9c093f842cbb',
            propertyNeighborhood: 'Centro',
            propertyType: UnitType.APARTMENT,
            propertyUnitNumber: '101-A',
          },
        ],
      });

      const result = await service.listPaymentsForReview({ page: 2, limit: 10 });

      expect(result.meta).toEqual({ page: 2, limit: 10, total: 21, totalPages: 3 });
      expect(result.data[0]).toMatchObject({
        payment: { id: PAYMENT_ID, submittedByUserId: SUBMITTER_ID },
        contract: {
          tenant: { name: 'Maria da Silva', cpf: '***.***.***-25', email: 'm***@example.com' },
          propertyUnit: { neighborhood: 'Centro', unitNumber: '101-A' },
        },
      });
    });
  });

  describe('idempotency lookup', () => {
    it('reports an invoice that no longer exists', async () => {
      repository.findById.mockResolvedValueOnce(null);

      await expect(
        service.getPaymentByIdempotencyKey(INVOICE_ID, IDEMPOTENCY_KEY, SUBMITTER_ID, false),
      ).rejects.toEqual(new NotFoundException('Fatura não encontrada.'));
    });

    it('allows the submitter to recover the accepted invoice and payment', async () => {
      await service.submitPayment(INVOICE_ID, {
        idempotencyKey: IDEMPOTENCY_KEY,
        submittedByUserId: SUBMITTER_ID,
        amountCents: 25_00,
        method: PaymentMethod.CASH,
        proofType: null,
      });

      const result = await service.getPaymentByIdempotencyKey(
        INVOICE_ID,
        IDEMPOTENCY_KEY,
        SUBMITTER_ID,
        false,
      );

      expect(result.invoice).toBe(invoice);
      expect(result.payment.id).toBe(PAYMENT_ID);
    });

    it('does not claim an idempotency key that has no payment on the invoice', async () => {
      await expect(
        service.getPaymentByIdempotencyKey(INVOICE_ID, IDEMPOTENCY_KEY, SUBMITTER_ID, false),
      ).rejects.toEqual(new NotFoundException('Pagamento não encontrado para a chave informada.'));
    });

    it('prevents another non-admin user from probing the accepted key', async () => {
      await service.submitPayment(INVOICE_ID, {
        idempotencyKey: IDEMPOTENCY_KEY,
        submittedByUserId: SUBMITTER_ID,
        amountCents: 25_00,
        method: PaymentMethod.CASH,
        proofType: null,
      });

      await expect(
        service.getPaymentByIdempotencyKey(INVOICE_ID, IDEMPOTENCY_KEY, REVIEWER_ID, false),
      ).rejects.toEqual(
        new ForbiddenException('A chave de idempotência pertence a outro usuário.'),
      );
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
        SUBMITTER_ID,
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
        SUBMITTER_ID,
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
