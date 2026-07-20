import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export const DOCUMENT_RENDERER = Symbol('DOCUMENT_RENDERER');

export type DocumentComposer = (document: PDFKit.PDFDocument) => void;

export interface DocumentRenderer {
  render(compose: DocumentComposer, options?: PDFKit.PDFDocumentOptions): Promise<Buffer>;
}

@Injectable()
export class PdfKitDocumentRenderer implements DocumentRenderer {
  render(compose: DocumentComposer, options: PDFKit.PDFDocumentOptions = {}): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const document = new PDFDocument({
        autoFirstPage: true,
        ...options,
        info: {
          CreationDate: new Date(0),
          ModDate: new Date(0),
          ...options.info,
        },
      });
      const chunks: Buffer[] = [];

      document.on('data', (chunk: Buffer | Uint8Array) => {
        chunks.push(Buffer.from(chunk));
      });
      document.once('end', () => resolve(Buffer.concat(chunks)));
      document.once('error', reject);

      try {
        compose(document);
        document.end();
      } catch (error: unknown) {
        document.end();
        reject(
          error instanceof Error
            ? error
            : new Error('Falha ao compor documento PDF.', { cause: error }),
        );
      }
    });
  }
}
