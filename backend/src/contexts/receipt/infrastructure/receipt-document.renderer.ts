import { Inject, Injectable } from '@nestjs/common';
import {
  DOCUMENT_RENDERER,
  type DocumentRenderer,
} from '../../../infrastructure/pdf/document-renderer';
import { Receipt } from '../domain/receipt.entity';

@Injectable()
export class ReceiptDocumentRenderer {
  constructor(
    @Inject(DOCUMENT_RENDERER)
    private readonly renderer: DocumentRenderer,
  ) {}

  render(receipt: Receipt): Promise<Buffer> {
    return this.renderer.render(
      (document) => {
        document.fontSize(20).text('RECIBO', { align: 'center' });
        document
          .moveDown(0.4)
          .fontSize(11)
          .text(`Nº ${String(receipt.number).padStart(8, '0')}`, {
            align: 'center',
          });
        document.moveDown(2);
        document
          .fontSize(12)
          .text(
            `Recebemos de ${receipt.tenantName}, CPF ${ReceiptDocumentRenderer.formatCpf(receipt.tenantCpf)}, a importância de ${ReceiptDocumentRenderer.formatCurrency(receipt.amountCents)}.`,
            { align: 'justify', lineGap: 5 },
          );
        document.moveDown();
        document.text(`Unidade: ${receipt.propertyDescription}`);
        document.text(
          `Período: ${ReceiptDocumentRenderer.formatDate(receipt.periodStart)} a ${ReceiptDocumentRenderer.formatDate(receipt.periodEnd)}`,
        );
        document.text(`Forma de pagamento: ${receipt.paymentMethod}`);
        document.moveDown(2);
        document.text(
          `Emitido em ${receipt.issuedAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`,
        );
        document.moveDown(3);
        document.text('TenancyLedger', { align: 'center' });
      },
      {
        size: 'A4',
        margins: { top: 64, right: 64, bottom: 64, left: 64 },
        info: { Title: `Recibo ${receipt.number}`, Author: 'TenancyLedger' },
      },
    );
  }

  static formatCurrency(cents: number): string {
    return (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  private static formatCpf(cpf: string): string {
    return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }

  private static formatDate(value: string): string {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
}
