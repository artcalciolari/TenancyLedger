import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { civilDateInTimeZone } from '../../core/domain/civil-date';

interface ContractAggregateRow {
  total: string | number;
  active: string | number;
  expired: string | number;
  terminated: string | number;
  expiringNext30Days: string | number;
}

interface InvoiceAggregateRow {
  total: string | number;
  totalValueCents: string | number;
  approvedAmountCents: string | number;
  outstandingAmountCents: string | number;
  overdueAmountCents: string | number;
  underReview: string | number;
  submittedPayments: string | number;
}

export interface DashboardSummary {
  asOf: string;
  contracts: {
    total: number;
    active: number;
    expired: number;
    terminated: number;
    expiringNext30Days: number;
  };
  invoices: {
    total: number;
    totalValueCents: number;
    approvedAmountCents: number;
    outstandingAmountCents: number;
    overdueAmountCents: number;
    underReview: number;
  };
  payments: { submitted: number };
}

@Injectable()
export class DashboardService {
  constructor(private readonly dataSource: DataSource) {}

  async getSummary(asOf = civilDateInTimeZone(new Date())): Promise<DashboardSummary> {
    const [contractRows, invoiceRows] = await Promise.all([
      this.dataSource.query<ContractAggregateRow[]>(
        `SELECT
          COUNT(*)::int AS "total",
          COUNT(*) FILTER (
            WHERE status <> 'TERMINATED' AND end_date >= $1::date
          )::int AS "active",
          COUNT(*) FILTER (
            WHERE status <> 'TERMINATED' AND end_date < $1::date
          )::int AS "expired",
          COUNT(*) FILTER (WHERE status = 'TERMINATED')::int AS "terminated",
          COUNT(*) FILTER (
            WHERE status <> 'TERMINATED'
              AND end_date >= $1::date
              AND end_date <= ($1::date + INTERVAL '30 days')::date
          )::int AS "expiringNext30Days"
        FROM contracts`,
        [asOf],
      ),
      this.dataSource.query<InvoiceAggregateRow[]>(
        `WITH payment_totals AS (
          SELECT
            invoice_id,
            COALESCE(SUM(amount_cents) FILTER (WHERE status = 'APPROVED'), 0)::bigint AS approved,
            COUNT(*) FILTER (WHERE status = 'SUBMITTED')::int AS submitted
          FROM payment_transactions
          GROUP BY invoice_id
        ), effective AS (
          SELECT
            invoice.id,
            invoice.total_value_cents,
            invoice.due_date,
            COALESCE(payment.approved, 0)::bigint AS approved,
            COALESCE(payment.submitted, 0)::int AS submitted,
            CASE
              WHEN COALESCE(payment.approved, 0) = invoice.total_value_cents THEN 'PAID'
              WHEN COALESCE(payment.submitted, 0) > 0 THEN 'UNDER_REVIEW'
              WHEN COALESCE(payment.approved, 0) > 0 THEN 'PARTIALLY_PAID'
              WHEN invoice.due_date < $1::date THEN 'OVERDUE'
              ELSE 'OPEN'
            END AS effective_status
          FROM invoices invoice
          LEFT JOIN payment_totals payment ON payment.invoice_id = invoice.id
        )
        SELECT
          COUNT(*)::int AS "total",
          COALESCE(SUM(total_value_cents), 0)::bigint AS "totalValueCents",
          COALESCE(SUM(approved), 0)::bigint AS "approvedAmountCents",
          COALESCE(SUM(total_value_cents - approved), 0)::bigint AS "outstandingAmountCents",
          COALESCE(SUM(total_value_cents - approved) FILTER (
            WHERE effective_status = 'OVERDUE'
          ), 0)::bigint AS "overdueAmountCents",
          COUNT(*) FILTER (WHERE effective_status = 'UNDER_REVIEW')::int AS "underReview",
          COALESCE(SUM(submitted), 0)::int AS "submittedPayments"
        FROM effective`,
        [asOf],
      ),
    ]);
    const contracts = contractRows[0];
    const invoices = invoiceRows[0];
    return {
      asOf,
      contracts: {
        total: Number(contracts?.total ?? 0),
        active: Number(contracts?.active ?? 0),
        expired: Number(contracts?.expired ?? 0),
        terminated: Number(contracts?.terminated ?? 0),
        expiringNext30Days: Number(contracts?.expiringNext30Days ?? 0),
      },
      invoices: {
        total: Number(invoices?.total ?? 0),
        totalValueCents: Number(invoices?.totalValueCents ?? 0),
        approvedAmountCents: Number(invoices?.approvedAmountCents ?? 0),
        outstandingAmountCents: Number(invoices?.outstandingAmountCents ?? 0),
        overdueAmountCents: Number(invoices?.overdueAmountCents ?? 0),
        underReview: Number(invoices?.underReview ?? 0),
      },
      payments: { submitted: Number(invoices?.submittedPayments ?? 0) },
    };
  }
}
