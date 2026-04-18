import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from '../../contract/domain/entities/contract.entity';
import { Invoice } from '../domain/entities/invoice.entity';

@Injectable()
export class InvoiceGenerationWorker
{
  private readonly logger = new Logger(InvoiceGenerationWorker.name);

  constructor(
    @InjectRepository(Contract) private readonly contractRepo: Repository<Contract>,
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateUpcomingInvoices(): Promise<void>
  {
    this.logger.log('Buscando contratos para geração de faturas...');

    // Como os atributos são encapsulados no TypeORM, precisamos referenciá-los pelo nome real da coluna via query builder
    const upcomingContracts = await this.contractRepo
      .createQueryBuilder('contract')
      // A query de data seria ajustada conforme sua regra de "próximo ao vencimento" (ex: daqui 7 dias)
      // Aqui vou buscar todos apenas para exemplificar
      .getMany();

    for (const contract of upcomingContracts)
    {
      try
      {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7); // Exemplo arbitrário

        // Factory method isola a criação. Novamente: nasce PENDING.
        const invoice = Invoice.create(contract.id, contract.monthlyBaseValue, dueDate);

        await this.invoiceRepo.save(invoice);
        this.logger.log(`Fatura criada com sucesso para o contrato ${contract.id}`);
      }
      catch (error)
      {
        this.logger.error(`Erro ao gerar fatura para o contrato ${contract.id}: ${error.message}`);
      }
    }
  }
}
