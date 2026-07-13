import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly httpRequests = new Counter({
    name: 'tenancy_ledger_http_requests_total',
    help: 'Total HTTP requests handled by the API',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [this.registry],
  });
  private readonly httpDuration = new Histogram({
    name: 'tenancy_ledger_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });
  private readonly invoiceGeneration = new Counter({
    name: 'tenancy_ledger_invoice_generation_total',
    help: 'Invoice generation job outcomes',
    labelNames: ['outcome'] as const,
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'tenancy_ledger_process_',
    });
  }

  recordHttpRequest(method: string, route: string, status: number, durationSeconds: number): void {
    const labels = { method, route, status: String(status) };
    this.httpRequests.inc(labels);
    this.httpDuration.observe(labels, durationSeconds);
  }

  recordInvoiceGeneration(result: {
    created: number;
    existing: number;
    markedOverdue: number;
  }): void {
    this.invoiceGeneration.inc({ outcome: 'created' }, result.created);
    this.invoiceGeneration.inc({ outcome: 'existing' }, result.existing);
    this.invoiceGeneration.inc({ outcome: 'marked_overdue' }, result.markedOverdue);
  }

  recordInvoiceGenerationError(): void {
    this.invoiceGeneration.inc({ outcome: 'error' });
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
