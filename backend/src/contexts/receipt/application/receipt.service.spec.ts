import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { StorageService } from '../../../infrastructure/storage.service';
import { Receipt } from '../domain/receipt.entity';
import { ReceiptService } from './receipt.service';

const RECEIPT_ID = 'df248760-6617-4dae-a7f2-3e80d7eac89a';
const PAYMENT_ID = '283b10d3-58f2-42d8-aa93-777f55ec9476';

describe('ReceiptService', () => {
  let repository: jest.Mocked<Pick<Repository<Receipt>, 'findOneBy'>>;
  let createDocumentReadUrl: jest.Mock;
  let service: ReceiptService;
  let receipt: Receipt;

  beforeEach(() => {
    receipt = Object.assign(new Receipt(), {
      id: RECEIPT_ID,
      paymentTransactionId: PAYMENT_ID,
      storageKey: `documents/receipts/${RECEIPT_ID}/document.pdf`,
    });
    repository = { findOneBy: jest.fn().mockResolvedValue(receipt) };
    createDocumentReadUrl = jest
      .fn()
      .mockResolvedValue('https://storage.example/receipt.pdf?signature=test');
    service = new ReceiptService(
      repository as unknown as Repository<Receipt>,
      { createDocumentReadUrl } as unknown as StorageService,
    );
  });

  it('loads a receipt by id', async () => {
    await expect(service.get(RECEIPT_ID)).resolves.toBe(receipt);
    expect(repository.findOneBy.mock.calls).toContainEqual([{ id: RECEIPT_ID }]);
  });

  it('loads a receipt by payment transaction', async () => {
    await expect(service.getByPayment(PAYMENT_ID)).resolves.toBe(receipt);
    expect(repository.findOneBy.mock.calls).toContainEqual([{ paymentTransactionId: PAYMENT_ID }]);
  });

  it.each([
    ['id', () => service.get(RECEIPT_ID), 'Recibo não encontrado.'],
    ['payment', () => service.getByPayment(PAYMENT_ID), 'Recibo do pagamento não encontrado.'],
  ])('returns not found for a missing receipt by %s', async (_scenario, operation, message) => {
    repository.findOneBy.mockResolvedValue(null);
    await expect(operation()).rejects.toEqual(new NotFoundException(message));
  });

  it('creates a short-lived private download URL', async () => {
    await expect(service.getDownloadUrl(RECEIPT_ID)).resolves.toEqual({
      url: 'https://storage.example/receipt.pdf?signature=test',
      expiresInSeconds: 300,
    });
    expect(createDocumentReadUrl.mock.calls).toContainEqual([receipt.storageKey, 300, 'inline']);
  });
});
