import { PdfKitDocumentRenderer } from '../../../infrastructure/pdf/document-renderer';
import { ContractDocumentRenderer } from './contract-document.renderer';

describe('ContractDocumentRenderer', () => {
  it('renders a valid monthly contract PDF', async () => {
    const renderer = new ContractDocumentRenderer(new PdfKitDocumentRenderer());

    const result = await renderer.render({
      contractId: '4d4d05b6-b5db-47c7-91fc-b0c86c036d9f',
      tenantName: 'Maria da Silva',
      tenantCpf: '52998224725',
      tenantRg: '12.345.678-9',
      propertyDescription: 'Apartamento 101-A — Centro',
      monthlyValueCents: 185_050,
      moveInDate: '2026-07-18',
      firstPeriodEnd: '2026-08-17',
    });

    expect(result.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(result.length).toBeGreaterThan(1_000);
  });

  it('formats the monthly value in BRL', () => {
    const formatted = ContractDocumentRenderer.formatCurrency(185_050);
    expect(formatted).toContain('1.850,50');
    expect(formatted).toContain('R$');
  });
});
