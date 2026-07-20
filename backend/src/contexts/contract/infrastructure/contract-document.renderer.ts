import { Inject, Injectable } from '@nestjs/common';
import {
  DOCUMENT_RENDERER,
  type DocumentRenderer,
} from '../../../infrastructure/pdf/document-renderer';

export interface ContractDocumentTemplateData {
  contractId: string;
  tenantName: string;
  tenantCpf: string;
  tenantRg: string;
  propertyDescription: string;
  monthlyValueCents: number;
  moveInDate: string;
  firstPeriodEnd: string;
}

@Injectable()
export class ContractDocumentRenderer {
  constructor(
    @Inject(DOCUMENT_RENDERER)
    private readonly renderer: DocumentRenderer,
  ) {}

  render(data: ContractDocumentTemplateData): Promise<Buffer> {
    return this.renderer.render(
      (document) => {
        document.fontSize(18).text('CONTRATO DE LOCAÇÃO MENSAL', { align: 'center' });
        document.moveDown(0.5).fontSize(9).text(`Contrato ${data.contractId}`, {
          align: 'center',
        });
        document.moveDown(2).fontSize(11);
        document.text(
          `LOCATÁRIO: ${data.tenantName}, CPF ${ContractDocumentRenderer.formatCpf(data.tenantCpf)}, RG ${data.tenantRg}.`,
          { align: 'justify', lineGap: 4 },
        );
        document.moveDown();
        document.text(`UNIDADE LOCADA: ${data.propertyDescription}.`, {
          align: 'justify',
          lineGap: 4,
        });
        document.moveDown();
        document.text(
          `ALUGUEL: ${ContractDocumentRenderer.formatCurrency(data.monthlyValueCents)} por período mensal, com pagamento conforme a fatura emitida.`,
          { align: 'justify', lineGap: 4 },
        );
        document.moveDown();
        document.text(
          `VIGÊNCIA E RENOVAÇÃO: a locação inicia em ${ContractDocumentRenderer.formatDate(data.moveInDate)}. O primeiro período encerra em ${ContractDocumentRenderer.formatDate(data.firstPeriodEnd)} e o contrato renova-se automaticamente por novos períodos mensais, sem prazo final, até encerramento formal.`,
          { align: 'justify', lineGap: 4 },
        );
        document.moveDown(4);
        document.text('________________________________________', { align: 'center' });
        document.text(data.tenantName, { align: 'center' });
        document.moveDown(3);
        document.text('________________________________________', { align: 'center' });
        document.text('LOCADOR', { align: 'center' });
      },
      {
        size: 'A4',
        margins: { top: 56, right: 64, bottom: 56, left: 64 },
        info: { Title: `Contrato ${data.contractId}`, Author: 'TenancyLedger' },
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
