import { ArgumentsHost, ForbiddenException, Logger, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { HttpExceptionAuditFilter } from './http-exception-audit.filter';

interface ResponseHarness {
  host: ArgumentsHost;
  status: jest.MockedFunction<(status: number) => Response>;
  type: jest.MockedFunction<(contentType: string) => Response>;
  json: jest.MockedFunction<(body: unknown) => Response>;
}

function harnessFor(
  path = '/invoices/invoice-1',
  user: { id?: string; sub?: string; role?: string } | undefined = {
    id: 'admin-1',
    role: 'admin',
  },
): ResponseHarness {
  const request = {
    method: 'GET',
    path,
    originalUrl: `${path}?include=payments`,
    user,
    header: jest.fn((name: string) => (name === 'x-request-id' ? 'request-123' : undefined)),
  } as unknown as Request;
  const response = {} as Response;
  const status = jest.fn<Response, [number]>().mockReturnValue(response);
  const type = jest.fn<Response, [string]>().mockReturnValue(response);
  const json = jest.fn<Response, [unknown]>().mockReturnValue(response);
  Object.assign(response, { status, type, json });
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
      getNext: jest.fn(),
    }),
  } as unknown as ArgumentsHost;

  return { host, status, type, json };
}

describe('HttpExceptionAuditFilter', () => {
  let insert: jest.MockedFunction<(entry: unknown) => Promise<unknown>>;
  let filter: HttpExceptionAuditFilter;

  beforeEach(() => {
    insert = jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({});
    filter = new HttpExceptionAuditFilter({
      insert,
    } as unknown as Repository<AuditLog>);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    [new UnauthorizedException(), 401, 'Unauthorized'],
    [new ForbiddenException(), 403, 'Forbidden'],
  ])(
    'returns and audits denied requests as HTTP %s',
    async (exception, expectedStatus, expectedDetail) => {
      const response = harnessFor('/properties/property-1', {
        sub: 'operator-1',
        role: 'operator',
      });

      await filter.catch(exception, response.host);

      expect(response.status).toHaveBeenCalledWith(expectedStatus);
      expect(response.type).toHaveBeenCalledWith('application/problem+json');
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: expectedStatus,
          detail: expectedDetail,
          instance: '/properties/property-1?include=payments',
          requestId: 'request-123',
        }),
      );
      expect(insert).toHaveBeenCalledWith({
        actorId: 'operator-1',
        action: `DENIED GET /properties/property-1`,
        resourceType: 'properties',
        resourceId: null,
        requestId: 'request-123',
        metadata: {
          method: 'GET',
          path: '/properties/property-1',
          statusCode: expectedStatus,
          role: 'operator',
        },
      });
    },
  );

  it('waits for the failure audit and does not expose an unexpected error', async () => {
    const response = harnessFor();
    const internalSecret = 'postgres://ledger:super-secret@database.internal/tenancy';
    const exception = new Error(`Connection failed: ${internalSecret}`);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    let finishInsert: (() => void) | undefined;
    insert.mockReturnValue(
      new Promise((resolve) => {
        finishInsert = () => resolve({});
      }),
    );

    const catchPromise = filter.catch(exception, response.host);
    await Promise.resolve();

    const insertedEntry = insert.mock.calls[0]?.[0];
    expect(insertedEntry).toMatchObject({
      action: 'FAILED GET /invoices/invoice-1',
      resourceType: 'invoices',
      actorId: 'admin-1',
      metadata: { statusCode: 500 },
    });
    expect(response.json).not.toHaveBeenCalled();

    expect(finishInsert).toBeDefined();
    finishInsert?.();
    await catchPromise;

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledTimes(1);
    const payload = response.json.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      type: 'https://tenancy-ledger.local/problems/http-500',
      title: 'Error',
      status: 500,
      detail: 'An unexpected error occurred.',
      instance: '/invoices/invoice-1?include=payments',
      requestId: 'request-123',
    });
    expect(JSON.stringify(payload)).not.toContain(internalSecret);
    expect(JSON.stringify(payload)).not.toContain('Connection failed');
  });
});
