import { Logger } from '@nestjs/common';
import {
  HealthCheckError,
  HealthCheckService,
  HealthIndicatorResult,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { StorageService } from '../storage.service';
import { HealthController } from './health.controller';

type Indicator = () => Promise<HealthIndicatorResult>;

describe('HealthController', () => {
  let check: jest.Mock;
  let pingCheck: jest.Mock;
  let checkConnection: jest.Mock;
  let controller: HealthController;

  beforeEach(() => {
    check = jest.fn(async (indicators: Indicator[]) => {
      const details = await Promise.all(indicators.map((indicator) => indicator()));
      return { status: 'ok', details };
    });
    pingCheck = jest.fn().mockResolvedValue({ database: { status: 'up' } });
    checkConnection = jest.fn().mockResolvedValue(undefined);

    controller = new HealthController(
      { check } as unknown as HealthCheckService,
      { pingCheck } as unknown as TypeOrmHealthIndicator,
      { checkConnection } as unknown as StorageService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exposes a minimal liveness response', () => {
    const live = controller.live();
    const liveness = controller.liveness();

    expect(live.status).toBe('ok');
    expect(Number.isNaN(Date.parse(live.timestamp))).toBe(false);
    expect(liveness.status).toBe('ok');
    expect(Number.isNaN(Date.parse(liveness.timestamp))).toBe(false);
  });

  it('checks both PostgreSQL and private object storage for readiness', async () => {
    await expect(controller.ready()).resolves.toMatchObject({ status: 'ok' });

    expect(check).toHaveBeenCalledTimes(1);
    expect(pingCheck).toHaveBeenCalledWith('database', { timeout: 1_500 });
    expect(checkConnection).toHaveBeenCalledTimes(1);
  });

  it('returns a generic object-storage failure without exposing provider details', async () => {
    const providerSecret = 'SignatureDoesNotMatch for access key TENANCY_LEDGER_SUPER_SECRET';
    checkConnection.mockRejectedValue(new Error(providerSecret));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    let caught: unknown;
    try {
      await controller.ready();
    } catch (error: unknown) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(HealthCheckError);
    expect(caught).toMatchObject({ message: 'Object storage is unavailable' });
    expect(JSON.stringify(caught)).toContain('Object storage readiness check failed');
    expect(JSON.stringify(caught)).not.toContain(providerSecret);
  });
});
