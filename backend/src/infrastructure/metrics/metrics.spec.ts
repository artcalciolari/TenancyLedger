import { CallHandler, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { firstValueFrom, of, throwError } from 'rxjs';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';

describe('metrics infrastructure', () => {
  it('renders HTTP and invoice job metrics', async () => {
    const metrics = new MetricsService();
    metrics.recordHttpRequest('GET', '/tenants', 200, 0.025);
    metrics.recordInvoiceGeneration({
      created: 2,
      existing: 1,
      markedOverdue: 3,
    });
    metrics.recordInvoiceGenerationError();

    const output = await metrics.metrics();
    expect(output).toContain('tenancy_ledger_http_requests_total');
    expect(output).toContain('route="/tenants"');
    expect(output).toContain('outcome="created"} 2');
    expect(output).toContain('outcome="error"} 1');
    expect(metrics.contentType).toContain('text/plain');
  });

  it('records an HTTP request after the handler completes', async () => {
    const recordHttpRequest = jest.fn();
    const metrics = { recordHttpRequest } as unknown as MetricsService;
    const interceptor = new MetricsInterceptor(metrics);
    const request = {
      method: 'POST',
      route: { path: '/contracts/:id' },
    } as unknown as Request;
    const response = { statusCode: 201 } as Response;
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
    const next = { handle: () => of({ id: '1' }) } as CallHandler;

    await firstValueFrom(interceptor.intercept(context, next));

    expect(recordHttpRequest).toHaveBeenCalledWith(
      'POST',
      '/contracts/:id',
      201,
      expect.any(Number),
    );
  });

  it('bypasses non-HTTP execution contexts', async () => {
    const recordHttpRequest = jest.fn();
    const metrics = { recordHttpRequest } as unknown as MetricsService;
    const interceptor = new MetricsInterceptor(metrics);
    const context = { getType: () => 'rpc' } as ExecutionContext;

    await firstValueFrom(interceptor.intercept(context, { handle: () => of('ok') } as CallHandler));

    expect(recordHttpRequest).not.toHaveBeenCalled();
  });

  it('records the exception status instead of the pre-filter response status', async () => {
    const recordHttpRequest = jest.fn();
    const interceptor = new MetricsInterceptor({
      recordHttpRequest,
    } as unknown as MetricsService);
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', route: { path: '/tenants' } }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;

    await expect(
      firstValueFrom(
        interceptor.intercept(context, {
          handle: () => throwError(() => new UnauthorizedException('unauthorized')),
        } as CallHandler),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(recordHttpRequest).toHaveBeenCalledWith('GET', '/tenants', 401, expect.any(Number));
  });

  it('serves metrics only with a constant-time token check', async () => {
    const metrics = {
      contentType: 'text/plain; version=0.0.4',
      metrics: jest.fn().mockResolvedValue('# metrics'),
    } as unknown as MetricsService;
    const config = {
      getOrThrow: jest.fn().mockReturnValue('development-metrics-token'),
    } as unknown as ConfigService;
    const controller = new MetricsController(metrics, config);
    const responseType = jest.fn().mockReturnThis();
    const responseSend = jest.fn().mockReturnThis();
    const response = {
      type: responseType,
      send: responseSend,
    } as unknown as Response;

    await controller.metrics('development-metrics-token', response);

    expect(responseType).toHaveBeenCalledWith(metrics.contentType);
    expect(responseSend).toHaveBeenCalledWith('# metrics');
    await expect(controller.metrics('wrong', response)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      controller.metrics('x'.repeat('development-metrics-token'.length), response),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
