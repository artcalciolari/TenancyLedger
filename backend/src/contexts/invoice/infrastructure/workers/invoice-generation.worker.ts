import { Inject, Injectable, Logger, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { CONTRACT_REPOSITORY_TOKEN } from '../../../contract/domain/repositories/contract.repository.interface';
import type { IContractRepository } from '../../../contract/domain/repositories/contract.repository.interface';
import { Invoice } from '../../domain/entities/invoice.entity';
import { INVOICE_REPOSITORY_TOKEN } from '../../domain/invoice.repository';
import type { IInvoiceRepository } from '../../domain/invoice.repository';
import { MetricsService } from '../../../../infrastructure/metrics/metrics.service';
import { ContractType } from '../../../contract/domain/entities/contract.entity';
import { addCivilDays, calendarPeriodFrom } from '../../../../core/domain/calendar-period';

export const CLOCK_TOKEN = Symbol('CLOCK_TOKEN');
const INVOICE_CRON_JOB = 'invoice-generation';

export interface Clock {
  now(): Date;
}

@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export interface InvoiceGenerationResult {
  eligibleContracts: number;
  created: number;
  existing: number;
  markedOverdue: number;
}

@Injectable()
export class InvoiceGenerationWorker implements OnApplicationBootstrap {
  private readonly logger = new Logger(InvoiceGenerationWorker.name);

  constructor(
    @Inject(CONTRACT_REPOSITORY_TOKEN)
    private readonly contractRepository: IContractRepository,
    @Inject(INVOICE_REPOSITORY_TOKEN)
    private readonly invoiceRepository: IInvoiceRepository,
    @Inject(CLOCK_TOKEN)
    private readonly clock: Clock,
    private readonly config: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.get<boolean>('INVOICE_CRON_ENABLED', true)) {
      this.logger.log('Geração automática de faturas desabilitada.');
      return;
    }
    const timeZone = this.config.get<string>('INVOICE_CRON_TIME_ZONE', 'America/Sao_Paulo');
    const job = CronJob.from({
      cronTime: '0 0 * * *',
      timeZone,
      start: false,
      onTick: () => void this.runScheduledGeneration(),
    });
    this.schedulerRegistry.addCronJob(INVOICE_CRON_JOB, job);
    job.start();
    this.logger.log(`Geração automática de faturas agendada para 00:00 (${timeZone}).`);
  }

  private async runScheduledGeneration(): Promise<void> {
    try {
      const result = await this.generateUpcomingInvoices();
      this.logger.log(
        `Geração concluída: ${result.created} criada(s), ${result.existing} já existente(s).`,
      );
    } catch (error) {
      this.metrics?.recordInvoiceGenerationError();
      const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
      this.logger.error(`Falha na geração automática de faturas: ${message}`);
    }
  }

  async generateUpcomingInvoices(): Promise<InvoiceGenerationResult> {
    const now = this.clock.now();
    const timeZone = this.config.get<string>('INVOICE_CRON_TIME_ZONE', 'America/Sao_Paulo');
    const today = InvoiceGenerationWorker.dateInTimeZone(now, timeZone);
    const daysAhead = this.config.get<number>('INVOICE_GENERATION_DAYS_AHEAD', 7);
    const windowEnd = InvoiceGenerationWorker.addDays(today, daysAhead);
    const firstCompetence = today.slice(0, 7);
    const periodStart = `${firstCompetence}-01`;

    const [contracts, markedOverdue] = await Promise.all([
      this.contractRepository.findActiveInPeriod(periodStart, windowEnd),
      this.invoiceRepository.markOpenInvoicesOverdue(today),
    ]);
    const competences = InvoiceGenerationWorker.competencesBetween(
      firstCompetence,
      windowEnd.slice(0, 7),
    );

    let created = 0;
    let existing = 0;
    for (const contract of contracts) {
      if (contract.contractType === ContractType.MONTH_TO_MONTH) {
        let cursor = contract.moveInDate;
        let period = calendarPeriodFrom(cursor);
        while (period.end < periodStart) {
          cursor = addCivilDays(period.end, 1);
          period = calendarPeriodFrom(cursor);
        }
        while (period.start <= windowEnd) {
          const competence = period.start.slice(0, 7);
          const contractualDueDate = contract.dueDateFor(competence);
          const dueDate = contractualDueDate < period.start ? period.start : contractualDueDate;
          if (dueDate <= windowEnd) {
            const invoice = Invoice.create(
              contract.id,
              competence,
              contract.monthlyBaseValueCents,
              dueDate,
              period.start,
              period.end,
            );
            if (await this.invoiceRepository.insertIfAbsent(invoice)) created += 1;
            else existing += 1;
          }
          cursor = addCivilDays(period.end, 1);
          period = calendarPeriodFrom(cursor);
        }
        continue;
      }
      for (const competence of competences) {
        const dueDate = contract.dueDateFor(competence);
        if (dueDate > windowEnd || dueDate < periodStart || !contract.isActiveOn(dueDate)) continue;

        const invoice = Invoice.create(
          contract.id,
          competence,
          contract.monthlyBaseValueCents,
          dueDate,
        );
        if (await this.invoiceRepository.insertIfAbsent(invoice)) created += 1;
        else existing += 1;
      }
    }

    const result = {
      eligibleContracts: contracts.length,
      created,
      existing,
      markedOverdue,
    };
    this.metrics?.recordInvoiceGeneration(result);
    return result;
  }

  private static dateInTimeZone(date: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find((part) => part.type === type)?.value ?? '';
    return `${value('year')}-${value('month')}-${value('day')}`;
  }

  private static addDays(date: string, days: number): string {
    const parsed = new Date(`${date}T00:00:00.000Z`);
    parsed.setUTCDate(parsed.getUTCDate() + days);
    return parsed.toISOString().slice(0, 10);
  }

  private static competencesBetween(start: string, end: string): string[] {
    const startYear = Number(start.slice(0, 4));
    const startMonth = Number(start.slice(5, 7));
    const endYear = Number(end.slice(0, 4));
    const endMonth = Number(end.slice(5, 7));
    const result: string[] = [];
    let cursor = startYear * 12 + startMonth - 1;
    const last = endYear * 12 + endMonth - 1;
    while (cursor <= last) {
      result.push(`${Math.floor(cursor / 12)}-${String((cursor % 12) + 1).padStart(2, '0')}`);
      cursor += 1;
    }
    return result;
  }
}
