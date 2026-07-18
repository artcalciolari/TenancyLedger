import {
  ArgumentsHost,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { ConflictError } from '../../domain/errors/conflict.error';
import { DomainError } from '../../domain/errors/domain.error';
import { NotFoundError } from '../../domain/errors/not-found.error';
import { ValidationError } from '../../domain/errors/validation.error';
import { AuditLog } from './audit-log.entity';
import { HttpExceptionAuditFilter } from './http-exception-audit.filter';

interface ResponseHarness {
  host: ArgumentsHost;
  status: jest.MockedFunction<(status: number) => Response>;
  type: jest.MockedFunction<(contentType: string) => Response>;
  json: jest.MockedFunction<(body: unknown) => Response>;
}

interface RequestOverrides {
  method?: string;
  path?: string;
  originalUrl?: string;
  user?: { id?: string; sub?: string; role?: string };
  requestId?: string | null;
}

class ContractConflictError extends ConflictError {}
class ContractNotFoundError extends NotFoundError {}
class ContractRuleError extends DomainError {}

function harnessFor(overrides: RequestOverrides = {}): ResponseHarness {
  const path = overrides.path ?? '/invoices/invoice-1';
  const user = 'user' in overrides ? overrides.user : { id: 'admin-1', role: 'admin' };
  const requestId = 'requestId' in overrides ? overrides.requestId : 'request-123';
  const request = {
    method: overrides.method ?? 'GET',
    path,
    originalUrl: overrides.originalUrl ?? `${path}?include=payments`,
    user,
    header: jest.fn((name: string) =>
      name === 'x-request-id' ? (requestId ?? undefined) : undefined,
    ),
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
      const response = harnessFor({
        path: '/properties/property-1',
        user: {
          sub: 'operator-1',
          role: 'operator',
        },
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

  it.each([
    {
      exception: new ContractNotFoundError('Contrato não encontrado.', 'contract-not-found'),
      status: HttpStatus.NOT_FOUND,
      code: 'contract-not-found',
    },
    {
      exception: new ContractConflictError('Contrato conflitante.', 'contract-conflict'),
      status: HttpStatus.CONFLICT,
      code: 'contract-conflict',
    },
    {
      exception: new ValidationError('Contrato inválido.', 'contract-invalid'),
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      code: 'contract-invalid',
    },
    {
      exception: new ContractRuleError('Regra do contrato violada.', 'contract-rule'),
      status: HttpStatus.BAD_REQUEST,
      code: 'contract-rule',
    },
  ])(
    'maps $code domain failures to observable Problem Details and audit status $status',
    async ({ exception, status, code }) => {
      const response = harnessFor({ method: 'PATCH', path: '/contracts/contract-1' });

      await filter.catch(exception, response.host);

      expect(response.status).toHaveBeenCalledWith(status);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          type: `https://tenancy-ledger.local/problems/${code}`,
          title: exception.name,
          status,
          detail: exception.message,
          errors: undefined,
        }),
      );
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'FAILED PATCH /contracts/contract-1',
        }),
      );
      expect(insert.mock.calls[0]?.[0]).toMatchObject({
        metadata: { statusCode: status },
      });
    },
  );

  it('returns all string validation messages without leaking non-string response values', async () => {
    const response = harnessFor({ method: 'POST', path: '/contracts' });
    const exception = new HttpException(
      { message: ['tenantId must be a UUID', 42, 'duration must be positive'] },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );

    await filter.catch(exception, response.host);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'https://tenancy-ledger.local/problems/http-422',
        status: 422,
        detail: 'tenantId must be a UUID',
        errors: ['tenantId must be a UUID', 'duration must be positive'],
      }),
    );
  });

  it('uses a string HttpException response as the public detail', async () => {
    const response = harnessFor({ method: 'POST', path: '/contracts' });

    await filter.catch(
      new HttpException('Explicit conflict response', HttpStatus.CONFLICT),
      response.host,
    );

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 409, detail: 'Explicit conflict response' }),
    );
  });

  it('falls back to the exception message when its response has no public messages', async () => {
    const response = harnessFor({ method: 'POST', path: '/contracts' });
    const exception = new HttpException({ internalReason: 'constraint' }, HttpStatus.CONFLICT);

    await filter.catch(exception, response.host);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 409,
        detail: exception.message,
        errors: undefined,
      }),
    );
  });

  it('does not persist failure audits for health probes', async () => {
    const response = harnessFor({ path: '/health/ready' });

    await filter.catch(new ForbiddenException(), response.host);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(insert).not.toHaveBeenCalled();
  });

  it.each([new Error('audit database unavailable'), 'audit database unavailable'])(
    'still returns Problem Details when audit persistence rejects with %p',
    async (auditFailure) => {
      const loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      insert.mockRejectedValue(auditFailure);
      const response = harnessFor({ method: 'PATCH', path: '/contracts/contract-1' });

      await filter.catch(new ValidationError('Contrato inválido.'), response.host);

      expect(response.status).toHaveBeenCalledWith(422);
      expect(response.json).toHaveBeenCalledTimes(1);
      expect(loggerError).toHaveBeenCalledWith(
        'Could not persist the failed-request audit entry',
        auditFailure instanceof Error ? auditFailure.stack : undefined,
      );
    },
  );

  it('sanitizes a non-Error failure and records anonymous audit context', async () => {
    const loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const response = harnessFor({
      method: 'POST',
      path: '/',
      originalUrl: '/',
      user: undefined,
      requestId: null,
    });

    await filter.catch('opaque internal failure', response.host);

    expect(insert).toHaveBeenCalledWith({
      actorId: null,
      action: 'FAILED POST /',
      resourceType: 'unknown',
      resourceId: null,
      requestId: null,
      metadata: {
        method: 'POST',
        path: '/',
        statusCode: 500,
        role: null,
      },
    });
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'https://tenancy-ledger.local/problems/http-500',
        title: 'InternalServerError',
        status: 500,
        detail: 'An unexpected error occurred.',
        requestId: null,
      }),
    );
    expect(loggerError).toHaveBeenCalledWith('Unhandled request error', undefined);
  });

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
