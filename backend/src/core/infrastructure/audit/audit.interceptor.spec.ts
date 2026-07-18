import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { firstValueFrom, of } from 'rxjs';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditInterceptor } from './audit.interceptor';

interface RequestOverrides {
  method?: string;
  path?: string;
  routePath?: string;
  route?: unknown;
  user?: { id?: string; sub?: string; role?: string };
  requestId?: string;
}

function requestOf(overrides: RequestOverrides = {}): Request {
  const requestId = overrides.requestId;
  return {
    method: overrides.method ?? 'GET',
    path: overrides.path ?? '/properties',
    route:
      'route' in overrides
        ? overrides.route
        : { path: overrides.routePath ?? overrides.path ?? '/properties' },
    user: overrides.user,
    header: jest.fn((name: string) => (name === 'x-request-id' ? requestId : undefined)),
  } as unknown as Request;
}

function contextOf(request: Request, statusCode = 200, type = 'http'): ExecutionContext {
  const response = { statusCode } as Response;
  return {
    getType: () => type,
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passes non-HTTP execution through without inspecting or auditing it', async () => {
    const body = { consumedBy: 'worker' };
    const handle = jest.fn(() => of(body));

    await expect(
      firstValueFrom(
        interceptor.intercept(contextOf(requestOf(), 200, 'rpc'), {
          handle,
        } as CallHandler),
      ),
    ).resolves.toBe(body);

    expect(handle).toHaveBeenCalledTimes(1);
    expect(insert).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'client telemetry', method: 'POST', path: '/client-errors' },
    { label: 'an ordinary GET', method: 'GET', path: '/version' },
    { label: 'an ordinary HEAD', method: 'HEAD', path: '/version' },
  ])('does not audit $label request', async ({ method, path }) => {
    const body = { accepted: true };

    await expect(
      firstValueFrom(
        interceptor.intercept(contextOf(requestOf({ method, path })), {
          handle: () => of(body),
        } as CallHandler),
      ),
    ).resolves.toBe(body);

    expect(insert).not.toHaveBeenCalled();
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

  it.each(['ADMIN', 'MANAGER'])(
    'marks tenant PII returned by PATCH as unmasked for %s without copying PII into metadata',
    async (role) => {
      const request = requestOf({
        method: 'PATCH',
        path: '/tenants/tenant-1',
        routePath: '/tenants/:id',
        user: { id: 'operator-1', role },
      });
      const body = {
        id: 'tenant-1',
        name: 'Maria da Silva',
        cpf: '123.456.789-09',
        rg: '12.345.678-9',
        email: 'maria@example.com',
        phone: '(11) 99999-9999',
      };

      await firstValueFrom(
        interceptor.intercept(contextOf(request), {
          handle: () => of(body),
        } as CallHandler),
      );

      const metadata = metadataOf(insert);
      expect(metadata).toEqual({
        method: 'PATCH',
        path: '/tenants/tenant-1',
        statusCode: 200,
        role,
        piiUnmasked: true,
      });
      for (const piiValue of [body.cpf, body.rg, body.email, body.phone]) {
        expect(JSON.stringify(metadata)).not.toContain(piiValue);
      }
    },
  );

  it.each([
    { label: 'VIEWER', user: { id: 'viewer-1', role: 'VIEWER' } },
    { label: 'an unauthenticated request', user: undefined },
  ])('does not mark tenant PII returned by PATCH as unmasked for $label', async ({ user }) => {
    const request = requestOf({
      method: 'PATCH',
      path: '/tenants/tenant-1',
      routePath: '/tenants/:id',
      user,
    });

    await firstValueFrom(
      interceptor.intercept(contextOf(request), {
        handle: () =>
          of({
            id: 'tenant-1',
            cpf: '***.***.***-09',
            email: 'm***@example.com',
            phone: '(**) *****-9999',
          }),
      } as CallHandler),
    );

    expect(metadataOf(insert)).toEqual({
      method: 'PATCH',
      path: '/tenants/tenant-1',
      statusCode: 200,
      role: user?.role ?? null,
    });
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

  it.each([new Error('audit database unavailable'), 'audit database unavailable'])(
    'releases the response when audit persistence rejects with %p',
    async (auditFailure) => {
      const loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      insert.mockRejectedValue(auditFailure);
      const body = { id: 'contract-1' };
      const request = requestOf({ method: 'POST', path: '/contracts' });

      await expect(
        firstValueFrom(
          interceptor.intercept(contextOf(request, 201), {
            handle: () => of(body),
          } as CallHandler),
        ),
      ).resolves.toBe(body);

      expect(loggerError).toHaveBeenCalledWith(
        'Could not persist the audit trail entry',
        auditFailure instanceof Error ? auditFailure.stack : undefined,
      );
    },
  );

  it('audits anonymous responses with null route and body context', async () => {
    const request = requestOf({
      method: 'POST',
      path: '/',
      route: null,
      user: undefined,
    });

    await firstValueFrom(
      interceptor.intercept(contextOf(request, 202), {
        handle: () => of(null),
      } as CallHandler),
    );

    expect(insert).toHaveBeenCalledWith({
      actorId: null,
      action: 'POST /',
      resourceType: 'unknown',
      resourceId: null,
      requestId: null,
      metadata: {
        method: 'POST',
        path: '/',
        statusCode: 202,
        role: null,
      },
    });
  });

  it.each([
    {
      label: 'a primitive body and absent route metadata',
      body: 'accepted',
      route: undefined,
    },
    {
      label: 'non-string direct and nested identifiers',
      body: { id: 42, user: { id: 43 } },
      route: { path: 44 },
    },
  ])('falls back to request context for $label', async ({ body, route }) => {
    const request = requestOf({ method: 'POST', path: '/sessions', route });

    await firstValueFrom(
      interceptor.intercept(contextOf(request), {
        handle: () => of(body),
      } as CallHandler),
    );

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'POST /sessions',
        resourceType: 'sessions',
        resourceId: null,
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
