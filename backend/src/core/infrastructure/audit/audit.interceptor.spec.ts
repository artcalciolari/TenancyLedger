import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Request, Response } from 'express';
import { firstValueFrom, of } from 'rxjs';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditInterceptor } from './audit.interceptor';

interface RequestOverrides {
  method?: string;
  path?: string;
  routePath?: string;
  user?: { id?: string; sub?: string; role?: string };
  requestId?: string;
}

function requestOf(overrides: RequestOverrides = {}): Request {
  const requestId = overrides.requestId;
  return {
    method: overrides.method ?? 'GET',
    path: overrides.path ?? '/properties',
    route: { path: overrides.routePath ?? overrides.path ?? '/properties' },
    user: overrides.user,
    header: jest.fn((name: string) => (name === 'x-request-id' ? requestId : undefined)),
  } as unknown as Request;
}

function contextOf(request: Request, statusCode = 200): ExecutionContext {
  const response = { statusCode } as Response;
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
      getNext: jest.fn(),
    }),
  } as unknown as ExecutionContext;
}

function metadataOf(insert: jest.Mock): AuditLog['metadata'] {
  const call = insert.mock.calls.at(0) as [Partial<AuditLog>] | undefined;
  return call?.[0].metadata ?? {};
}

describe('AuditInterceptor', () => {
  let insert: jest.Mock;
  let interceptor: AuditInterceptor;

  beforeEach(() => {
    insert = jest.fn().mockResolvedValue({});
    interceptor = new AuditInterceptor({
      insert,
    } as unknown as Repository<AuditLog>);
  });

  it('waits for the audit insert before releasing the response body', async () => {
    let finishInsert: (() => void) | undefined;
    insert.mockReturnValue(
      new Promise((resolve) => {
        finishInsert = () => resolve({});
      }),
    );
    const body = { id: 'property-1', name: 'Unit 101' };
    const request = requestOf({
      path: '/properties/property-1',
      routePath: '/properties/:id',
      user: { id: 'admin-1', role: 'admin' },
      requestId: 'request-1',
    });

    const resultPromise = firstValueFrom(
      interceptor.intercept(contextOf(request), {
        handle: () => of(body),
      } as CallHandler),
    );
    let released = false;
    void resultPromise.then(() => {
      released = true;
    });

    await Promise.resolve();
    expect(insert).toHaveBeenCalledTimes(1);
    expect(released).toBe(false);

    expect(finishInsert).toBeDefined();
    finishInsert?.();
    await expect(resultPromise).resolves.toBe(body);
    expect(released).toBe(true);
  });

  it('audits sensitive GETs such as properties with actor and request context', async () => {
    const request = requestOf({
      path: '/properties/property-1',
      routePath: '/properties/:id',
      user: { sub: 'operator-1', role: 'manager' },
      requestId: 'trace-123',
    });

    await firstValueFrom(
      interceptor.intercept(contextOf(request), {
        handle: () => of({ id: 'property-1' }),
      } as CallHandler),
    );

    expect(insert).toHaveBeenCalledWith({
      actorId: 'operator-1',
      action: 'GET /properties/:id',
      resourceType: 'properties',
      resourceId: 'property-1',
      requestId: 'trace-123',
      metadata: {
        method: 'GET',
        path: '/properties/property-1',
        statusCode: 200,
        role: 'manager',
      },
    });
  });

  it('does not mark tenant PII as unmasked for a viewer', async () => {
    const request = requestOf({
      path: '/tenants',
      user: { id: 'viewer-1', role: 'VIEWER' },
    });

    await firstValueFrom(
      interceptor.intercept(contextOf(request), {
        handle: () => of({ data: [] }),
      } as CallHandler),
    );

    expect(metadataOf(insert)).not.toHaveProperty('piiUnmasked');
  });

  it('marks tenant PII as unmasked for a manager', async () => {
    const request = requestOf({
      path: '/tenants',
      user: { id: 'manager-1', role: 'MANAGER' },
    });

    await firstValueFrom(
      interceptor.intercept(contextOf(request), {
        handle: () => of({ data: [] }),
      } as CallHandler),
    );

    expect(metadataOf(insert)).toMatchObject({ piiUnmasked: true });
  });

  it('marks an unmasked contracts CSV export for a manager', async () => {
    const request = requestOf({
      path: '/contracts/export.csv',
      user: { id: 'manager-1', role: 'MANAGER' },
    });

    await firstValueFrom(
      interceptor.intercept(contextOf(request), {
        handle: () => of({}),
      } as CallHandler),
    );

    expect(metadataOf(insert)).toMatchObject({ piiUnmasked: true, export: true });
  });

  it('does not mark an audited route without tenant PII as unmasked', async () => {
    const request = requestOf({
      method: 'POST',
      path: '/buildings',
      user: { id: 'manager-1', role: 'MANAGER' },
    });

    await firstValueFrom(
      interceptor.intercept(contextOf(request), {
        handle: () => of({ id: 'building-1' }),
      } as CallHandler),
    );

    expect(metadataOf(insert)).not.toHaveProperty('piiUnmasked');
  });

  it('uses the authenticated user returned by login as the login audit actor', async () => {
    const request = requestOf({
      method: 'POST',
      path: '/auth/login',
      routePath: '/auth/login',
    });

    await firstValueFrom(
      interceptor.intercept(contextOf(request, 201), {
        handle: () => of({ user: { id: 'logged-in-user' }, accessToken: 'jwt' }),
      } as CallHandler),
    );

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'logged-in-user',
        action: 'POST /auth/login',
        resourceType: 'auth',
        resourceId: 'logged-in-user',
      }),
    );
  });

  it('does not audit health probes', async () => {
    const body = { status: 'ok' };

    await expect(
      firstValueFrom(
        interceptor.intercept(contextOf(requestOf({ path: '/health/ready' })), {
          handle: () => of(body),
        } as CallHandler),
      ),
    ).resolves.toBe(body);
    expect(insert).not.toHaveBeenCalled();
  });
});
