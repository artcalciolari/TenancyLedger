import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import {
  Contract,
  ContractStatus,
  ContractType,
} from '../../../contract/domain/entities/contract.entity';
import type {
  ContractListResult,
  IContractRepository,
} from '../../../contract/domain/repositories/contract.repository.interface';
import { Invoice } from '../../domain/entities/invoice.entity';
import type { IInvoiceRepository, InvoiceListResult } from '../../domain/invoice.repository';
import { MetricsService } from '../../../../infrastructure/metrics/metrics.service';
import { Clock, InvoiceGenerationWorker, SystemClock } from './invoice-generation.worker';

const TENANT_ID = '2f267fc5-d330-426f-9702-fdf000b9d36b';
const PROPERTY_ID = '98b49e58-3d94-4ac2-831f-88a95d322ab5';
const CONTRACT_ID = 'ab9db0dc-b4a7-4ff8-9b9d-528d9ac93030';

function contract(): Contract {
  const value = Contract.create(TENANT_ID, PROPERTY_ID, '2026-01-01', 123_45, 24, true, 19);
  Object.defineProperty(value, 'id', { value: CONTRACT_ID });
  return value;
}

class FakeContractRepository implements IContractRepository {
  constructor(private readonly contracts: Contract[]) {}
  save(value: Contract): Promise<Contract> {
    return Promise.resolve(value);
  }
  findById(): Promise<Contract | null> {
    return Promise.resolve(null);
  }
  findByIdForUpdate(): Promise<Contract | null> {
    return Promise.resolve(null);
  }
  runInTransaction<T>(operation: (repository: IContractRepository) => Promise<T>): Promise<T> {
    return operation(this);
  }
  list(): Promise<ContractListResult> {
    return Promise.resolve({ items: [], total: 0 });
  }
  listForExport(): Promise<Contract[]> {
    return Promise.resolve([]);
  }
  markExpired(): Promise<number> {
    return Promise.resolve(0);
  }
  hasOverlap(): Promise<boolean> {
    return Promise.resolve(false);
  }
  findActiveInPeriod(): Promise<Contract[]> {
    return Promise.resolve(
      this.contracts.filter((value) => value.status === ContractStatus.ACTIVE),
    );
  }
}

class FakeInvoiceRepository implements IInvoiceRepository {
  readonly stored = new Map<string, Invoice>();
  overdueCalls: string[] = [];
  constructor(private readonly markedOverdue = 0) {}
  findById(): Promise<Invoice | null> {
    return Promise.resolve(null);
  }
  findByContractAndCompetence(): Promise<Invoice | null> {
    return Promise.resolve(null);
  }
  list(): Promise<InvoiceListResult> {
    return Promise.resolve({ items: [], total: 0 });
  }
  listForExport(): Promise<Invoice[]> {
    return Promise.resolve([]);
  }
  listPaymentsForReview(): Promise<{ items: []; total: number }> {
    return Promise.resolve({ items: [], total: 0 });
  }
  updateWithLock(): Promise<Invoice | null> {
    return Promise.resolve(null);
  }
  markOpenInvoicesOverdue(asOf: string): Promise<number> {
    this.overdueCalls.push(asOf);
    return Promise.resolve(this.markedOverdue);
  }
  insertIfAbsent(invoice: Invoice): Promise<boolean> {
    const key = `${invoice.contractId}:${invoice.competence}`;
    if (this.stored.has(key)) return Promise.resolve(false);
    this.stored.set(key, invoice);
    return Promise.resolve(true);
  }
}

function runScheduledGeneration(worker: InvoiceGenerationWorker): Promise<void> {
  return (
    worker as unknown as {
      runScheduledGeneration(): Promise<void>;
    }
  ).runScheduledGeneration();
}

function metricsHarness(): {
  metrics: MetricsService;
  recordInvoiceGeneration: jest.Mock;
  recordInvoiceGenerationError: jest.Mock;
} {
  const recordInvoiceGeneration = jest.fn();
  const recordInvoiceGenerationError = jest.fn();
  return {
    metrics: {
      recordInvoiceGeneration,
      recordInvoiceGenerationError,
    } as unknown as MetricsService,
    recordInvoiceGeneration,
    recordInvoiceGenerationError,
  };
}

describe('InvoiceGenerationWorker', () => {
  const clock: Clock = { now: () => new Date('2026-07-12T14:00:00.000Z') };

  function createWorker(
    invoices: FakeInvoiceRepository,
    contracts = [contract()],
    metrics?: MetricsService,
  ): InvoiceGenerationWorker {
    const config = new ConfigService({
      INVOICE_CRON_ENABLED: true,
      INVOICE_CRON_TIME_ZONE: 'America/Sao_Paulo',
      INVOICE_GENERATION_DAYS_AHEAD: 7,
    });
    return new InvoiceGenerationWorker(
      new FakeContractRepository(contracts),
      invoices,
      clock,
      config,
      new SchedulerRegistry(),
      metrics,
    );
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('provides the current time through the production system clock', () => {
    const before = Date.now();

    const current = new SystemClock().now();

    expect(current).toBeInstanceOf(Date);
    expect(current.getTime()).toBeGreaterThanOrEqual(before);
    expect(current.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('is idempotent for contract and competence', async () => {
    const invoices = new FakeInvoiceRepository();
    const worker = createWorker(invoices);

    const first = await worker.generateUpcomingInvoices();
    const second = await worker.generateUpcomingInvoices();

    expect(first).toMatchObject({ eligibleContracts: 1, created: 1, existing: 0 });
    expect(second).toMatchObject({ eligibleContracts: 1, created: 0, existing: 1 });
    expect(invoices.stored.size).toBe(1);
    expect([...invoices.stored.values()][0]).toMatchObject({
      competence: '2026-07',
      dueDate: '2026-07-19',
      totalValueCents: 123_45,
    });
  });

  it('generates an inclusive calendar period for a month-to-month contract', async () => {
    const value = Contract.create(
      TENANT_ID,
      PROPERTY_ID,
      '2026-07-18',
      123_45,
      null,
      true,
      18,
      ContractType.MONTH_TO_MONTH,
    );
    Object.defineProperty(value, 'id', { value: CONTRACT_ID });
    const invoices = new FakeInvoiceRepository();

    const result = await createWorker(invoices, [value]).generateUpcomingInvoices();

    expect(result).toMatchObject({ eligibleContracts: 1, created: 1, existing: 0 });
    expect([...invoices.stored.values()][0]).toMatchObject({
      competence: '2026-07',
      dueDate: '2026-07-18',
      periodStart: '2026-07-18',
      periodEnd: '2026-08-17',
    });
  });

  it('does not create an invoice whose due date is outside the configured window', async () => {
    const value = Contract.create(TENANT_ID, PROPERTY_ID, '2026-01-01', 123_45, 24, true, 20);
    Object.defineProperty(value, 'id', { value: CONTRACT_ID });
    const invoices = new FakeInvoiceRepository();

    const result = await createWorker(invoices, [value]).generateUpcomingInvoices();

    expect(result.created).toBe(0);
    expect(invoices.stored.size).toBe(0);
  });

  it('does not create an invoice before the contract becomes active', async () => {
    const value = Contract.create(TENANT_ID, PROPERTY_ID, '2026-07-15', 123_45, 24, true, 10);
    Object.defineProperty(value, 'id', { value: CONTRACT_ID });
    const invoices = new FakeInvoiceRepository();

    const result = await createWorker(invoices, [value]).generateUpcomingInvoices();

    expect(result).toMatchObject({ eligibleContracts: 1, created: 0, existing: 0 });
    expect(invoices.stored.size).toBe(0);
  });

  it('uses the configured timezone date and refreshes overdue invoices', async () => {
    const invoices = new FakeInvoiceRepository();
    await createWorker(invoices).generateUpcomingInvoices();
    expect(invoices.overdueCalls).toEqual(['2026-07-12']);
  });

  it('records created, existing, and overdue generation outcomes in metrics', async () => {
    const invoices = new FakeInvoiceRepository(2);
    const { metrics, recordInvoiceGeneration } = metricsHarness();
    const worker = createWorker(invoices, [contract()], metrics);

    const first = await worker.generateUpcomingInvoices();
    const second = await worker.generateUpcomingInvoices();

    expect(first).toMatchObject({ created: 1, existing: 0, markedOverdue: 2 });
    expect(second).toMatchObject({ created: 0, existing: 1, markedOverdue: 2 });
    expect(recordInvoiceGeneration).toHaveBeenNthCalledWith(1, first);
    expect(recordInvoiceGeneration).toHaveBeenNthCalledWith(2, second);
  });

  it('registers the enabled cron and dispatches generation when it ticks', async () => {
    const registry = new SchedulerRegistry();
    const loggerLog = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const worker = new InvoiceGenerationWorker(
      new FakeContractRepository([]),
      new FakeInvoiceRepository(),
      clock,
      new ConfigService({}),
      registry,
    );
    const generate = jest.spyOn(worker, 'generateUpcomingInvoices').mockResolvedValue({
      eligibleContracts: 0,
      created: 0,
      existing: 0,
      markedOverdue: 0,
    });

    worker.onApplicationBootstrap();

    const job = registry.getCronJob('invoice-generation');
    expect(job.isActive).toBe(true);
    expect(loggerLog).toHaveBeenCalledWith(
      'Geração automática de faturas agendada para 00:00 (America/Sao_Paulo).',
    );
    await job.fireOnTick();
    expect(generate).toHaveBeenCalledTimes(1);
    registry.deleteCronJob('invoice-generation');
  });

  it('logs the created and existing totals after a scheduled generation succeeds', async () => {
    const worker = createWorker(new FakeInvoiceRepository(), []);
    jest.spyOn(worker, 'generateUpcomingInvoices').mockResolvedValue({
      eligibleContracts: 2,
      created: 3,
      existing: 4,
      markedOverdue: 1,
    });
    const loggerLog = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    await runScheduledGeneration(worker);

    expect(loggerLog).toHaveBeenCalledWith('Geração concluída: 3 criada(s), 4 já existente(s).');
  });

  it.each([
    (() => {
      const error = new Error('invoice repository unavailable');
      error.stack = undefined;
      return { failure: error, message: 'invoice repository unavailable' };
    })(),
    { failure: 'invoice repository unavailable', message: 'invoice repository unavailable' },
  ])('records and logs scheduled generation failure $failure', async ({ failure, message }) => {
    const { metrics, recordInvoiceGenerationError } = metricsHarness();
    const worker = createWorker(new FakeInvoiceRepository(), [], metrics);
    jest.spyOn(worker, 'generateUpcomingInvoices').mockRejectedValue(failure);
    const loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await expect(runScheduledGeneration(worker)).resolves.toBeUndefined();

    expect(recordInvoiceGenerationError).toHaveBeenCalledTimes(1);
    expect(loggerError).toHaveBeenCalledWith(`Falha na geração automática de faturas: ${message}`);
  });

  it('does not register the cron when disabled', () => {
    const registry = new SchedulerRegistry();
    const worker = new InvoiceGenerationWorker(
      new FakeContractRepository([]),
      new FakeInvoiceRepository(),
      clock,
      new ConfigService({ INVOICE_CRON_ENABLED: false }),
      registry,
    );

    worker.onApplicationBootstrap();

    expect(() => registry.getCronJob('invoice-generation')).toThrow();
  });
});
