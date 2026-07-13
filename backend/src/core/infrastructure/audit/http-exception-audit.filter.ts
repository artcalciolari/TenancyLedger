import {
  ArgumentsHost,
  Catch,
  HttpStatus,
  ExceptionFilter,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { ConflictError } from '../../domain/errors/conflict.error';
import { DomainError } from '../../domain/errors/domain.error';
import { NotFoundError } from '../../domain/errors/not-found.error';
import { ValidationError } from '../../domain/errors/validation.error';
import { AuditLog } from './audit-log.entity';

interface AuthenticatedRequest extends Request {
  user?: { id?: string; sub?: string; role?: string };
}

@Catch()
@Injectable()
export class HttpExceptionAuditFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionAuditFilter.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
  ) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const http = host.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();
    const status = this.statusFrom(exception);
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;

    await this.recordFailure(request, status);

    const messages = exceptionResponse ? this.messagesFrom(exceptionResponse) : [];
    const domainCode = exception instanceof DomainError ? exception.code : `http-${status}`;
    const title = exception instanceof Error ? exception.name : 'InternalServerError';
    const detail =
      status === Number(HttpStatus.INTERNAL_SERVER_ERROR)
        ? 'An unexpected error occurred.'
        : (messages[0] ?? (exception instanceof Error ? exception.message : 'Request failed.'));

    if (status === Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error(
        'Unhandled request error',
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response
      .status(status)
      .type('application/problem+json')
      .json({
        type: `https://tenancy-ledger.local/problems/${domainCode}`,
        title,
        status,
        detail,
        errors: messages.length > 1 ? messages : undefined,
        instance: request.originalUrl,
        requestId: request.header('x-request-id') ?? null,
        timestamp: new Date().toISOString(),
      });
  }

  private statusFrom(exception: unknown): number {
    if (exception instanceof HttpException) return exception.getStatus();
    if (exception instanceof ConflictError) return HttpStatus.CONFLICT;
    if (exception instanceof ValidationError) {
      return HttpStatus.UNPROCESSABLE_ENTITY;
    }
    if (exception instanceof NotFoundError) return HttpStatus.NOT_FOUND;
    if (exception instanceof DomainError) return HttpStatus.BAD_REQUEST;
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private async recordFailure(request: AuthenticatedRequest, status: number): Promise<void> {
    if (request.path.startsWith('/health')) return;

    try {
      await this.auditLogs.insert({
        actorId: request.user?.id ?? request.user?.sub ?? null,
        action:
          `${status === 401 || status === 403 ? 'DENIED' : 'FAILED'} ${request.method} ${request.path}`.slice(
            0,
            120,
          ),
        resourceType: request.path.split('/').filter(Boolean).at(0)?.slice(0, 80) ?? 'unknown',
        resourceId: null,
        requestId: request.header('x-request-id') ?? null,
        metadata: {
          method: request.method,
          path: request.path,
          statusCode: status,
          role: request.user?.role ?? null,
        },
      });
    } catch (error: unknown) {
      this.logger.error(
        'Could not persist the failed-request audit entry',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private messagesFrom(response: string | object): string[] {
    if (typeof response === 'string') return [response];
    const message = Reflect.get(response, 'message') as unknown;
    if (Array.isArray(message)) {
      return message.filter((item): item is string => typeof item === 'string');
    }
    return typeof message === 'string' ? [message] : [];
  }
}
