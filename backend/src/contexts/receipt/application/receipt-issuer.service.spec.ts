import { NotFoundException } from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';
import { Contract } from '../../contract/domain/entities/contract.entity';
import { Invoice } from '../../invoice/domain/entities/invoice.entity';
import {
  PaymentMethod,
  type PaymentTransaction,
} from '../../invoice/domain/entities/payment-transaction.entity';
import { PropertyUnit, UnitType } from '../../property/domain/property-unit.entity';
import { Tenant, TenantCivilStatus } from '../../tenant/domain/entities/tenant.entity';
import type { StorageService } from '../../../infrastructure/storage.service';
import { Receipt } from '../domain/receipt.entity';
import type { ReceiptDocumentRenderer } from '../infrastructure/receipt-document.renderer';
import { ReceiptIssuerService } from './receipt-issuer.service';

const PAYMENT_ID = '283b10d3-58f2-42d8-aa93-777f55ec9476';
const INVOICE_ID = '0a60a4ca-1a8e-4f0a-b0ee-2196db87ac51';
const CONTRACT_ID = '4d4d05b6-b5db-47c7-91fc-b0c86c036d9f';
const TENANT_ID = '48bb503a-4d2a-4f56-88eb-6f7a9436ec67';
const PROPERTY_ID = 'c2926b25-4e17-44a8-8097-9c093f842cbb';
const USER_ID = '957a3866-f282-48d7-9180-5cbf99c74982';
const NOW = new Date('2026-07-18T15:30:00.000Z');

function assignId(target: object, id: string): void {
  Object.defineProperty(target, 'id', { value: id, configurable: true });
}

function approvedPayment(): { invoice: Invoice; payment: PaymentTransaction } {
  const invoice = Invoice.create(
    CONTRACT_ID,
    '2026-07',
    185_000,
    '2026-07-20',
    '2026-07-18',
    '2026-08-17',
  );
  assignId(invoice, INVOICE_ID);
  const payment = invoice.settleCash(185_000, NOW, 'cash-payment-0001', 'a'.repeat(64), USER_ID);
  assignId(payment, PAYMENT_ID);
  return { invoice, payment };
}

function submittedPayment(): { invoice: Invoice; payment: PaymentTransaction } {
  const invoice = Invoice.create(CONTRACT_ID, '2026-07', 185_000, '2026-07-20');
  assignId(invoice, INVOICE_ID);
  const payment = invoice.submitPayment(
    185_000,
    PaymentMethod.CASH,
    null,
    undefined,
    NOW,
    'cash-payment-0002',
    'b'.repeat(64),
    USER_ID,
  );
  assignId(payment, PAYMENT_ID);
  return { invoice, payment };
}

describe('ReceiptIssuerService', () => {
  let receiptRepository: jest.Mocked<Pick<Repository<Receipt>, 'findOne'>>;
  let contractRepository: jest.Mocked<Pick<Repository<Contract>, 'findOneBy'>>;
  let tenantRepository: jest.Mocked<Pick<Repository<Tenant>, 'findOneBy'>>;
  let propertyRepository: jest.Mocked<Pick<Repository<PropertyUnit>, 'findOneBy'>>;
  let manager: EntityManager;
  let query: jest.Mock;
  let save: jest.Mock;
  let uploadDocument: jest.Mock;
  let render: jest.Mock;
  let service: ReceiptIssuerService;

  beforeEach(() => {
    receiptRepository = { findOne: jest.fn().mockResolvedValue(null) };
    contractRepository = {
      findOneBy: jest.fn().mockResolvedValue({
        id: CONTRACT_ID,
        tenantId: TENANT_ID,
        propertyUnitId: PROPERTY_ID,
      }),
    };
    tenantRepository = {
      findOneBy: jest.fn().mockResolvedValue({
        id: TENANT_ID,
        name: 'Maria da Silva',
        cpf: '52998224725',
        civilStatus: TenantCivilStatus.SINGLE,
      }),
    };
    propertyRepository = {
      findOneBy: jest.fn().mockResolvedValue({
        id: PROPERTY_ID,
        type: UnitType.APARTMENT,
        unitNumber: '101-A',
        neighborhood: 'Centro',
      }),
    };
    query = jest.fn().mockResolvedValue([{ number: '41' }]);
    save = jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity));
    manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Receipt) return receiptRepository;
        if (entity === Contract) return contractRepository;
        if (entity === Tenant) return tenantRepository;
        if (entity === PropertyUnit) return propertyRepository;
        throw new Error('unexpected repository');
      }),
      query,
      save,
    } as unknown as EntityManager;
    uploadDocument = jest.fn().mockImplementation(({ ownerId }: { ownerId: string }) =>
      Promise.resolve({
        bucket: 'private-bucket',
        key: `documents/receipts/${ownerId}/document.pdf`,
      }),
    );
    render = jest.fn().mockResolvedValue(Buffer.from('%PDF-test'));
    service = new ReceiptIssuerService(
      { uploadDocument } as unknown as StorageService,
      { render } as unknown as ReceiptDocumentRenderer,
    );
  });

  it('issues and stores a sequential receipt from approved payment data', async () => {
    const { invoice, payment } = approvedPayment();
    const onStored = jest.fn();

    const result = await service.issue(invoice, payment, manager, onStored);

    expect(query.mock.calls).toContainEqual([
      `SELECT nextval('receipt_number_seq')::text AS number`,
    ]);
    expect(result).toMatchObject({
      number: 41,
      paymentTransactionId: PAYMENT_ID,
      invoiceId: INVOICE_ID,
      contractId: CONTRACT_ID,
      tenantId: TENANT_ID,
      tenantName: 'Maria da Silva',
      tenantCpf: '52998224725',
      propertyUnitId: PROPERTY_ID,
      propertyDescription: 'APARTMENT 101-A — Centro',
      periodStart: '2026-07-18',
      periodEnd: '2026-08-17',
      amountCents: 185_000,
      paymentMethod: PaymentMethod.CASH,
      issuedAt: NOW,
    });
    expect(render).toHaveBeenCalledWith(result);
    expect(uploadDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'receipts',
        ownerId: result.id,
        contentType: 'application/pdf',
        body: Buffer.from('%PDF-test'),
      }),
    );
    expect(onStored.mock.calls).toContainEqual([result.storageKey]);
    expect(save.mock.calls).toContainEqual([result]);
  });

  it('returns the existing receipt idempotently without allocating a number', async () => {
    const { invoice, payment } = approvedPayment();
    const existing = Object.assign(new Receipt(), { paymentTransactionId: PAYMENT_ID });
    receiptRepository.findOne.mockResolvedValue(existing);

    await expect(service.issue(invoice, payment, manager)).resolves.toBe(existing);
    expect(query).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
  });

  it('rejects a payment that has not been approved', async () => {
    const { invoice, payment } = submittedPayment();
    await expect(service.issue(invoice, payment, manager)).rejects.toThrow(
      'Somente pagamentos aprovados podem emitir recibo.',
    );
    expect(receiptRepository.findOne).not.toHaveBeenCalled();
  });

  it('falls back to the submission timestamp for an imported approved payment', async () => {
    const { invoice, payment } = submittedPayment();
    Reflect.set(payment, '_status', 'APPROVED');
    Reflect.set(payment, '_reviewedAt', null);

    const result = await service.issue(invoice, payment, manager);

    expect(result.issuedAt).toEqual(payment.submittedAt);
  });

  it('rejects a missing contract', async () => {
    const { invoice, payment } = approvedPayment();
    contractRepository.findOneBy.mockResolvedValue(null);
    await expect(service.issue(invoice, payment, manager)).rejects.toEqual(
      new NotFoundException('Contrato do recibo não encontrado.'),
    );
  });

  it.each(['tenant', 'property'] as const)('rejects a missing related %s', async (relation) => {
    const { invoice, payment } = approvedPayment();
    if (relation === 'tenant') tenantRepository.findOneBy.mockResolvedValue(null);
    else propertyRepository.findOneBy.mockResolvedValue(null);

    await expect(service.issue(invoice, payment, manager)).rejects.toEqual(
      new NotFoundException('Dados relacionados do recibo não encontrados.'),
    );
  });

  it('voids the stored receipt under a pessimistic lock', async () => {
    const { invoice, payment } = approvedPayment();
    const receipt = Receipt.create(
      1,
      {
        paymentTransactionId: payment.id,
        invoiceId: invoice.id,
        contractId: CONTRACT_ID,
        tenantId: TENANT_ID,
        tenantName: 'Maria da Silva',
        tenantCpf: '52998224725',
        propertyUnitId: PROPERTY_ID,
        propertyDescription: 'Apartamento 101 — Centro',
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        amountCents: payment.amountCents,
        paymentMethod: payment.method,
      },
      NOW,
    );
    receiptRepository.findOne.mockResolvedValue(receipt);
    const voidedAt = new Date('2026-07-19T15:30:00.000Z');

    await service.voidForPayment(PAYMENT_ID, 'erro operacional', voidedAt, manager);

    expect(receiptRepository.findOne.mock.calls).toContainEqual([
      {
        where: { paymentTransactionId: PAYMENT_ID },
        lock: { mode: 'pessimistic_write' },
      },
    ]);
    expect(receipt).toMatchObject({ voidedReason: 'erro operacional', voidedAt });
    expect(save.mock.calls).toContainEqual([receipt]);
  });

  it('does nothing when reversal has no receipt', async () => {
    await expect(
      service.voidForPayment(PAYMENT_ID, 'erro operacional', NOW, manager),
    ).resolves.toBeUndefined();
    expect(save).not.toHaveBeenCalled();
  });
});
