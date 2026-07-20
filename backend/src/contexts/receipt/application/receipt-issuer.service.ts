import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { StorageService } from '../../../infrastructure/storage.service';
import { Contract } from '../../contract/domain/entities/contract.entity';
import { Invoice } from '../../invoice/domain/entities/invoice.entity';
import {
  PaymentStatus,
  PaymentTransaction,
} from '../../invoice/domain/entities/payment-transaction.entity';
import { PropertyUnit } from '../../property/domain/property-unit.entity';
import { describePropertyUnit } from '../../property/domain/property-unit.description';
import { Tenant } from '../../tenant/domain/entities/tenant.entity';
import { Receipt } from '../domain/receipt.entity';
import { ReceiptDocumentRenderer } from '../infrastructure/receipt-document.renderer';

@Injectable()
export class ReceiptIssuerService {
  constructor(
    private readonly storage: StorageService,
    private readonly documentRenderer: ReceiptDocumentRenderer,
  ) {}

  async issue(
    invoice: Invoice,
    payment: PaymentTransaction,
    manager: EntityManager,
    onStored?: (storageKey: string) => void,
  ): Promise<Receipt> {
    if (payment.status !== PaymentStatus.APPROVED) {
      throw new Error('Somente pagamentos aprovados podem emitir recibo.');
    }
    const existing = await manager.getRepository(Receipt).findOne({
      where: { paymentTransactionId: payment.id },
    });
    if (existing) return existing;

    const contract = await manager.getRepository(Contract).findOneBy({ id: invoice.contractId });
    if (!contract) throw new NotFoundException('Contrato do recibo não encontrado.');
    const [tenant, property] = await Promise.all([
      manager.getRepository(Tenant).findOneBy({ id: contract.tenantId }),
      manager.getRepository(PropertyUnit).findOneBy({ id: contract.propertyUnitId }),
    ]);
    if (!tenant || !property) {
      throw new NotFoundException('Dados relacionados do recibo não encontrados.');
    }

    const sequenceRows = await manager.query<Array<{ number: string }>>(
      `SELECT nextval('receipt_number_seq')::text AS number`,
    );
    const number = Number(sequenceRows[0]?.number);
    const receipt = Receipt.create(
      number,
      {
        paymentTransactionId: payment.id,
        invoiceId: invoice.id,
        contractId: contract.id,
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantCpf: tenant.cpf,
        propertyUnitId: property.id,
        propertyDescription: describePropertyUnit(property),
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        amountCents: payment.amountCents,
        paymentMethod: payment.method,
      },
      payment.reviewedAt ?? payment.submittedAt,
    );
    const pdf = await this.documentRenderer.render(receipt);
    const stored = await this.storage.uploadDocument({
      folder: 'receipts',
      ownerId: receipt.id,
      contentType: 'application/pdf',
      body: pdf,
    });
    onStored?.(stored.key);
    receipt.setStorageKey(stored.key);
    return manager.save(receipt);
  }

  async voidForPayment(
    paymentId: string,
    reason: string,
    voidedAt: Date,
    manager: EntityManager,
  ): Promise<void> {
    const receipt = await manager.getRepository(Receipt).findOne({
      where: { paymentTransactionId: paymentId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!receipt) return;
    receipt.void(reason, voidedAt);
    await manager.save(receipt);
  }
}
