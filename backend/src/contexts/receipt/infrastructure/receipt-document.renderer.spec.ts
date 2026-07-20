import { PdfKitDocumentRenderer } from '../../../infrastructure/pdf/document-renderer';
import { Receipt } from '../domain/receipt.entity';
import { ReceiptDocumentRenderer } from './receipt-document.renderer';

function receipt(): Receipt {
  const current = Receipt.create(
    7,
    {
      paymentTransactionId: '283b10d3-58f2-42d8-aa93-777f55ec9476',
      invoiceId: '0a60a4ca-1a8e-4f0a-b0ee-2196db87ac51',
      contractId: '4d4d05b6-b5db-47c7-91fc-b0c86c036d9f',
      tenantId: '48bb503a-4d2a-4f56-88eb-6f7a9436ec67',
      tenantName: 'Maria da Silva',
      tenantCpf: '52998224725',
      propertyUnitId: 'c2926b25-4e17-44a8-8097-9c093f842cbb',
      propertyDescription: 'Apartamento 101 — Centro',
      periodStart: '2026-07-18',
      periodEnd: '2026-08-17',
      amountCents: 185_050,
      paymentMethod: 'CASH',
    },
    new Date('2026-07-18T15:30:00.000Z'),
  );
  current.setStorageKey(`documents/receipts/${current.id}/receipt.pdf`);
  return current;
}

describe('ReceiptDocumentRenderer', () => {
  it('renders a valid A4 PDF containing the receipt template', async () => {
    const renderer = new ReceiptDocumentRenderer(new PdfKitDocumentRenderer());

    const result = await renderer.render(receipt());

    expect(result.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(result.length).toBeGreaterThan(1_000);
  });

  it('formats BRL amounts using Brazilian presentation rules', () => {
    const formatted = ReceiptDocumentRenderer.formatCurrency(185_050);
    expect(formatted).toContain('1.850,50');
    expect(formatted).toContain('R$');
  });
});
