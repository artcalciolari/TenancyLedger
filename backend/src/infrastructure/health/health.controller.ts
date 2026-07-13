import { Controller, Get, Logger } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckService,
  HealthIndicatorResult,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../../contexts/auth/infrastructure/security/public.decorator';
import { StorageService } from '../storage.service';

@Public()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly health: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @SkipThrottle()
  live(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('live')
  @SkipThrottle()
  liveness(): { status: 'ok'; timestamp: string } {
    return this.live();
  }

  @Get('ready')
  @HealthCheck()
  ready(): ReturnType<HealthCheckService['check']> {
    return this.health.check([
      () => this.database.pingCheck('database', { timeout: 1_500 }),
      () => this.objectStorageHealth(),
    ]);
  }

  private async objectStorageHealth(): Promise<HealthIndicatorResult> {
    try {
      await this.storage.checkConnection();
      return { objectStorage: { status: 'up' } };
    } catch (error: unknown) {
      this.logger.error(
        'Object storage readiness check failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw new HealthCheckError('Object storage is unavailable', {
        objectStorage: {
          status: 'down',
          message: 'Object storage readiness check failed',
        },
      });
    }
  }
}
