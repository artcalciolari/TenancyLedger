import type { DataSource } from 'typeorm';
import { RenewalNotificationWorker } from './renewal-notification.worker';

describe('RenewalNotificationWorker', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('insere renovações e atrasos com chave idempotente por usuário e período', async () => {
    const query = jest
      .fn<Promise<Array<{ inserted: string }>>, [string, readonly unknown[]]>()
      .mockResolvedValue([{ inserted: '4' }]);
    const worker = new RenewalNotificationWorker({ query } as unknown as DataSource);

    await expect(worker.run('2026-07-18')).resolves.toBe(4);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (user_id, deduplication_key)'),
      ['2026-07-18'],
    );
    const sql = query.mock.calls[0]?.[0];
    expect(sql).toContain("contract.status = 'ACTIVE'");
    expect(sql).toContain("invoice.status = 'OVERDUE'");
    expect(sql).not.toContain('contract.move_in_date');
  });

  it('normaliza para zero quando nenhuma linha agregada é devolvida e o cron delega', async () => {
    const query = jest
      .fn<Promise<Array<{ inserted: string }>>, [string, readonly unknown[]]>()
      .mockResolvedValue([]);
    const worker = new RenewalNotificationWorker({ query } as unknown as DataSource);
    await expect(worker.run('2026-07-18')).resolves.toBe(0);

    const run = jest.spyOn(worker, 'run').mockResolvedValue(0);
    await expect(worker.handleCron()).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('uses the current civil date when no reference date is supplied', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-20T02:30:00.000Z'));
    const query = jest
      .fn<Promise<Array<{ inserted: number }>>, [string, readonly unknown[]]>()
      .mockResolvedValue([{ inserted: 1 }]);
    const worker = new RenewalNotificationWorker({ query } as unknown as DataSource);

    await expect(worker.run()).resolves.toBe(1);
    expect(query).toHaveBeenCalledWith(expect.any(String), ['2026-07-19']);
  });
});
