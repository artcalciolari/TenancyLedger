import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StorageService } from '../../../infrastructure/storage.service';
import { Receipt } from '../domain/receipt.entity';

@Injectable()
export class ReceiptService {
  constructor(
    @InjectRepository(Receipt)
    private readonly receipts: Repository<Receipt>,
    private readonly storage: StorageService,
  ) {}

  async get(id: string): Promise<Receipt> {
    const receipt = await this.receipts.findOneBy({ id });
    if (!receipt) throw new NotFoundException('Recibo não encontrado.');
    return receipt;
  }

  async getByPayment(paymentTransactionId: string): Promise<Receipt> {
    const receipt = await this.receipts.findOneBy({ paymentTransactionId });
    if (!receipt) throw new NotFoundException('Recibo do pagamento não encontrado.');
    return receipt;
  }

  async getDownloadUrl(id: string): Promise<{ url: string; expiresInSeconds: number }> {
    const receipt = await this.get(id);
    const expiresInSeconds = 300;
    return {
      url: await this.storage.createDocumentReadUrl(receipt.storageKey, expiresInSeconds, 'inline'),
      expiresInSeconds,
    };
  }
}
