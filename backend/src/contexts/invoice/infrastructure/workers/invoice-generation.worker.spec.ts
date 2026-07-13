import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Contract, ContractStatus } from '../../../contract/domain/entities/contract.entity';
import type {
  ContractListResult,
  IContractRepository,
} from '../../../contract/domain/repositories/contract.repository.interface';
import { Invoice } from '../../domain/entities/invoice.entity';
import type { IInvoiceRepository, InvoiceListResult } from '../../domain/invoice.repository';
import { Clock, InvoiceGenerationWorker } from './invoice-generation.worker';

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
    return Promise.resolve(0);
  }
  insertIfAbsent(invoice: Invoice): Promise<boolean> {
    const key = `${invoice.contractId}:${invoice.competence}`;
    if (this.stored.has(key)) return Promise.resolve(false);
    this.stored.set(key, invoice);
    return Promise.resolve(true);
  }
}

describe('InvoiceGenerationWorker', () => {
  const clock: Clock = { now: () => new Date('2026-07-12T14:00:00.000Z') };

  function createWorker(
    invoices: FakeInvoiceRepository,
    contracts = [contract()],
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
    );
  }

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

  it('does not create an invoice whose due date is outside the configured window', async () => {
    const value = Contract.create(TENANT_ID, PROPERTY_ID, '2026-01-01', 123_45, 24, true, 20);
    Object.defineProperty(value, 'id', { value: CONTRACT_ID });
    const invoices = new FakeInvoiceRepository();

    const result = await createWorker(invoices, [value]).generateUpcomingInvoices();

    expect(result.created).toBe(0);
    expect(invoices.stored.size).toBe(0);
  });

  it('uses the configured timezone date and refreshes overdue invoices', async () => {
    const invoices = new FakeInvoiceRepository();
    await createWorker(invoices).generateUpcomingInvoices();
    expect(invoices.overdueCalls).toEqual(['2026-07-12']);
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
