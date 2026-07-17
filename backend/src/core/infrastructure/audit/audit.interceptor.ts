import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request, Response } from 'express';
import { Observable, concatMap, from, map } from 'rxjs';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

interface AuthenticatedRequest extends Request {
  user?: { id?: string; sub?: string; role?: string };
}

const PII_UNMASKED_ROLES = new Set(['ADMIN', 'MANAGER']);

const PII_ROUTE_PATTERNS: ReadonlyArray<{
  method: string;
  path: RegExp;
}> = [
  { method: 'GET', path: /^\/tenants(?:\/[^/]+)?$/ },
  { method: 'GET', path: /^\/contracts(?:\/[^/]+)?$/ },
  { method: 'POST', path: /^\/tenants$/ },
  { method: 'POST', path: /^\/contracts$/ },
  { method: 'PATCH', path: /^\/tenants\/[^/]+$/ },
  { method: 'PATCH', path: /^\/contracts\/[^/]+\/renew$/ },
];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();

    if (!this.shouldAudit(request)) return next.handle();

    return next
      .handle()
      .pipe(
        concatMap((body: unknown) =>
          from(this.record(request, response.statusCode, body)).pipe(map(() => body)),
        ),
      );
  }

  private shouldAudit(request: Request): boolean {
    if (request.path.startsWith('/health')) return false;
    if (request.path.startsWith('/client-errors')) return false;
    if (request.method !== 'GET' && request.method !== 'HEAD') return true;

    return ['/tenants', '/properties', '/contracts', '/invoices', '/payments'].some((path) =>
      request.path.includes(path),
    );
  }

  private async record(
    request: AuthenticatedRequest,
    statusCode: number,
    body: unknown,
  ): Promise<void> {
    try {
      const resourceType = this.resourceTypeFrom(request.path);
      const resourceId = this.resourceIdFrom(body);
      const actorId =
        request.user?.id ??
        request.user?.sub ??
        (request.path.endsWith('/auth/login') ? resourceId : null);
      const requestId = request.header('x-request-id') ?? null;
      const metadata: AuditLog['metadata'] = {
        method: request.method,
        path: request.path,
        statusCode,
        role: request.user?.role ?? null,
      };

      if (this.servesUnmaskedPii(request)) metadata.piiUnmasked = true;
      if (request.path.endsWith('/export.csv')) metadata.export = true;

      await this.auditLogs.insert({
        actorId,
        action: `${request.method} ${this.routePath(request)}`.slice(0, 120),
        resourceType,
        resourceId,
        requestId,
        metadata,
      });
    } catch (error: unknown) {
      this.logger.error(
        'Could not persist the audit trail entry',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private servesUnmaskedPii(request: AuthenticatedRequest): boolean {
    const role = request.user?.role;
    if (!role || !PII_UNMASKED_ROLES.has(role)) return false;

    return PII_ROUTE_PATTERNS.some(
      ({ method, path }) => method === request.method && path.test(request.path),
    );
  }

  private resourceTypeFrom(path: string): string {
    return path.split('/').filter(Boolean).at(0)?.slice(0, 80) ?? 'unknown';
  }

  private resourceIdFrom(body: unknown): string | null {
    if (typeof body !== 'object' || body === null) return null;
    const id = Reflect.get(body, 'id') as unknown;
    if (typeof id === 'string') return id;
    const user = Reflect.get(body, 'user') as unknown;
    if (typeof user !== 'object' || user === null) return null;
    const userId = Reflect.get(user, 'id') as unknown;
    return typeof userId === 'string' ? userId : null;
  }

  private routePath(request: Request): string {
    const route = request.route as unknown;
    if (typeof route !== 'object' || route === null) return request.path;
    const path = Reflect.get(route, 'path') as unknown;
    return typeof path === 'string' ? path : request.path;
  }
}
