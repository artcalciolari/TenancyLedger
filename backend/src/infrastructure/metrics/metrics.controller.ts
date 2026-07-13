import { Controller, Get, Headers, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';
import { Public } from '../../contexts/auth/infrastructure/security/public.decorator';
import { MetricsService } from './metrics.service';

@Public()
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @SkipThrottle()
  async metrics(
    @Headers('x-metrics-token') token: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    if (!this.validToken(token)) {
      throw new UnauthorizedException('Invalid metrics token.');
    }
    response.type(this.metricsService.contentType).send(await this.metricsService.metrics());
  }

  private validToken(token: string | undefined): boolean {
    const expected = this.config.getOrThrow<string>('METRICS_TOKEN');
    if (!token) return false;
    const suppliedBuffer = Buffer.from(token);
    const expectedBuffer = Buffer.from(expected);
    return (
      suppliedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(suppliedBuffer, expectedBuffer)
    );
  }
}
