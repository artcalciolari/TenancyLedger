import { PdfKitDocumentRenderer } from './document-renderer';

describe('PdfKitDocumentRenderer', () => {
  const renderer = new PdfKitDocumentRenderer();

  it('renders a valid PDF buffer', async () => {
    const result = await renderer.render((document) => {
      document.fontSize(18).text('TenancyLedger');
    });

    expect(result.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(result.length).toBeGreaterThan(100);
  });

  it('supports PDFKit options and multiple chunks of content', async () => {
    const result = await renderer.render(
      (document) => {
        document.text('Primeira página');
        document.addPage().text('Segunda página');
      },
      { size: 'A4', margins: { top: 40, right: 40, bottom: 40, left: 40 } },
    );

    expect(result.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('is deterministic for the same document content and options', async () => {
    const compose = (document: PDFKit.PDFDocument): void => {
      document.text('Contrato mensal');
    };

    const first = await renderer.render(compose, { size: 'A4' });
    const second = await renderer.render(compose, { size: 'A4' });

    expect(second).toEqual(first);
  });

  it('rejects when the document composer fails', async () => {
    await expect(
      renderer.render(() => {
        throw new Error('template failure');
      }),
    ).rejects.toThrow('template failure');
  });

  it('wraps non-Error failures from a document composer', async () => {
    await expect(
      renderer.render(() => {
        // A JavaScript callback can still throw a non-Error at runtime.
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'template failure';
      }),
    ).rejects.toThrow('Falha ao compor documento PDF.');
  });
});
