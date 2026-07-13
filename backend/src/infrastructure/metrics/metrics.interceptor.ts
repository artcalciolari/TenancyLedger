import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, catchError, finalize, throwError } from 'rxjs';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startedAt = process.hrtime.bigint();
    let errorStatus: number | undefined;

    return next.handle().pipe(
      catchError((error: unknown) => {
        errorStatus = error instanceof HttpException ? error.getStatus() : 500;
        return throwError(() => error);
      }),
      finalize(() => {
        const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
        const routeMetadata = request.route as unknown;
        const routePath =
          typeof routeMetadata === 'object' && routeMetadata !== null
            ? (Reflect.get(routeMetadata, 'path') as unknown)
            : undefined;
        const route = typeof routePath === 'string' ? routePath.slice(0, 120) : 'unmatched';
        this.metrics.recordHttpRequest(
          request.method,
          route,
          errorStatus ?? response.statusCode,
          durationSeconds,
        );
      }),
    );
  }
}
