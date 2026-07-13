import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../domain/entities/invoice.entity';
import {
  IInvoiceRepository,
  InvoiceListOptions,
  InvoiceListResult,
} from '../domain/invoice.repository';

@Injectable()
export class InvoiceTypeOrmRepository implements IInvoiceRepository {
  constructor(
    @InjectRepository(Invoice)
    private readonly repository: Repository<Invoice>,
  ) {}

  findById(id: string): Promise<Invoice | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByContractAndCompetence(contractId: string, competence: string): Promise<Invoice | null> {
    return this.repository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice._transactions', 'transaction')
      .where('invoice._contractId = :contractId', { contractId })
      .andWhere('invoice._competence = :competence', { competence })
      .getOne();
  }

  async list(options: InvoiceListOptions): Promise<InvoiceListResult> {
    const query = this.repository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice._transactions', 'transaction')
      .orderBy('invoice._dueDate', 'DESC')
      .addOrderBy('invoice.id', 'ASC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit);
    if (options.contractId)
      query.andWhere('invoice._contractId = :contractId', { contractId: options.contractId });
    if (options.competence)
      query.andWhere('invoice._competence = :competence', { competence: options.competence });
    if (options.status) query.andWhere('invoice._status = :status', { status: options.status });
    const [items, total] = await query.getManyAndCount();
    return { items, total };
  }

  async insertIfAbsent(invoice: Invoice): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .into(Invoice)
      .values(invoice)
      .orIgnore()
      .returning('id')
      .execute();
    return Array.isArray(result.raw) && result.raw.length > 0;
  }

  async updateWithLock(
    id: string,
    update: (invoice: Invoice) => void | Promise<void>,
    transactionKey?: string,
  ): Promise<Invoice | null> {
    return this.repository.manager.transaction(async (manager) => {
      if (transactionKey) {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [
          'invoice-payment-idempotency',
          `${id}:${transactionKey}`,
        ]);
      }

      const invoice = await manager
        .getRepository(Invoice)
        .createQueryBuilder('invoice')
        .setLock('pessimistic_write', undefined, ['invoice'])
        .leftJoinAndSelect('invoice._transactions', 'transaction')
        .where('invoice.id = :id', { id })
        .getOne();
      if (!invoice) return null;
      await update(invoice);
      return manager.save(invoice);
    });
  }

  async markOpenInvoicesOverdue(asOf: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .update(Invoice)
      .set({ _status: 'OVERDUE' } as never)
      .where('status = :status', { status: 'OPEN' })
      .andWhere('due_date < :asOf', { asOf })
      .execute();
    return result.affected ?? 0;
  }
}
