import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { civilDateInTimeZone } from '../../core/domain/civil-date';
import { assertCivilDate } from '../../core/domain/calendar-period';
import { ValidationError } from '../../core/domain/errors/validation.error';

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

type FinancialKind = 'RECEIVED' | 'CONFIRMED_RECEIVABLE' | 'FORECAST_RENEWAL';

interface FinancialEventRow {
  eventDate: string | Date;
  kind: FinancialKind;
  amountCents: string | number;
  propertyUnitId: string;
  buildingId: string | null;
  neighborhood: string;
  unitNumber: string;
  buildingName: string | null;
}

export interface DashboardPropertyBreakdown {
  propertyUnitId: string;
  buildingId: string | null;
  buildingName: string | null;
  neighborhood: string;
  unitNumber: string;
  receivedCents: number;
  confirmedReceivableCents: number;
  forecastRenewalsCents: number;
}

export interface DashboardBuildingBreakdown {
  buildingId: string | null;
  buildingName: string | null;
  neighborhood: string;
  propertyUnitCount: number;
  receivedCents: number;
  confirmedReceivableCents: number;
  forecastRenewalsCents: number;
}

export interface DashboardDailyPoint {
  date: string;
  receivedCents: number;
  confirmedReceivableCents: number;
  forecastRenewalsCents: number;
}

export interface DashboardSummary {
  asOf: string;
  period: { from: string; to: string; forecastThrough: string };
  financial: {
    receivedCents: number;
    confirmedReceivableCents: number;
    forecastRenewalsCents: number;
    byProperty: DashboardPropertyBreakdown[];
    byBuilding: DashboardBuildingBreakdown[];
    daily: DashboardDailyPoint[];
  };
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

  async getSummary(
    asOf = civilDateInTimeZone(new Date()),
    from = `${asOf.slice(0, 7)}-01`,
    to = asOf,
  ): Promise<DashboardSummary> {
    DashboardService.assertPeriod(asOf, from, to);
    const forecastThrough = DashboardService.addDays(asOf, 30);
    const [contractRows, invoiceRows, financialRows] = await Promise.all([
      this.dataSource.query<ContractAggregateRow[]>(
        `SELECT
          COUNT(*)::int AS "total",
          COUNT(*) FILTER (
            WHERE status IN ('ACTIVE', 'ENDING')
              AND move_in_date <= $1::date
              AND (end_date IS NULL OR end_date >= $1::date)
          )::int AS "active",
          COUNT(*) FILTER (
            WHERE status = 'EXPIRED'
              OR (status IN ('ACTIVE', 'ENDING')
                AND end_date IS NOT NULL
                AND end_date < $1::date)
          )::int AS "expired",
          COUNT(*) FILTER (WHERE status IN ('TERMINATED', 'CANCELLED'))::int AS "terminated",
          COUNT(*) FILTER (
            WHERE status IN ('ACTIVE', 'ENDING')
              AND move_in_date <= $1::date
              AND end_date IS NOT NULL
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
      this.dataSource.query<FinancialEventRow[]>(DashboardService.financialQuery, [
        asOf,
        from,
        to,
        forecastThrough,
      ]),
    ]);
    const contracts = contractRows[0];
    const invoices = invoiceRows[0];
    const financial = DashboardService.aggregateFinancial(financialRows);
    return {
      asOf,
      period: { from, to, forecastThrough },
      financial,
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

  private static aggregateFinancial(rows: FinancialEventRow[]): DashboardSummary['financial'] {
    const totals = {
      receivedCents: 0,
      confirmedReceivableCents: 0,
      forecastRenewalsCents: 0,
    };
    const properties = new Map<string, DashboardPropertyBreakdown>();
    const daily = new Map<string, DashboardDailyPoint>();

    for (const row of rows) {
      const amount = Number(row.amountCents);
      const date =
        row.eventDate instanceof Date ? row.eventDate.toISOString().slice(0, 10) : row.eventDate;
      const property = properties.get(row.propertyUnitId) ?? {
        propertyUnitId: row.propertyUnitId,
        buildingId: row.buildingId,
        buildingName: row.buildingName,
        neighborhood: row.neighborhood,
        unitNumber: row.unitNumber,
        receivedCents: 0,
        confirmedReceivableCents: 0,
        forecastRenewalsCents: 0,
      };
      const point = daily.get(date) ?? {
        date,
        receivedCents: 0,
        confirmedReceivableCents: 0,
        forecastRenewalsCents: 0,
      };
      const key = DashboardService.kindKey(row.kind);
      totals[key] += amount;
      property[key] += amount;
      point[key] += amount;
      properties.set(row.propertyUnitId, property);
      daily.set(date, point);
    }

    const byProperty = [...properties.values()].sort((left, right) =>
      `${left.buildingName ?? ''}\u0000${left.neighborhood}\u0000${left.unitNumber}`.localeCompare(
        `${right.buildingName ?? ''}\u0000${right.neighborhood}\u0000${right.unitNumber}`,
        'pt-BR',
      ),
    );

    return {
      ...totals,
      byProperty,
      byBuilding: DashboardService.aggregateBuildings(byProperty),
      daily: [...daily.values()].sort((left, right) => left.date.localeCompare(right.date)),
    };
  }

  private static aggregateBuildings(
    properties: DashboardPropertyBreakdown[],
  ): DashboardBuildingBreakdown[] {
    const buildings = new Map<string, DashboardBuildingBreakdown>();

    for (const property of properties) {
      const groupKey = property.buildingId ?? `standalone:${property.neighborhood}`;
      const building = buildings.get(groupKey) ?? {
        buildingId: property.buildingId,
        buildingName: property.buildingName,
        neighborhood: property.neighborhood,
        propertyUnitCount: 0,
        receivedCents: 0,
        confirmedReceivableCents: 0,
        forecastRenewalsCents: 0,
      };
      building.propertyUnitCount += 1;
      building.receivedCents += property.receivedCents;
      building.confirmedReceivableCents += property.confirmedReceivableCents;
      building.forecastRenewalsCents += property.forecastRenewalsCents;
      buildings.set(groupKey, building);
    }

    return [...buildings.values()].sort((left, right) =>
      `${left.buildingId === null ? '1' : '0'}\u0000${left.buildingName ?? left.neighborhood}`.localeCompare(
        `${right.buildingId === null ? '1' : '0'}\u0000${right.buildingName ?? right.neighborhood}`,
        'pt-BR',
      ),
    );
  }

  private static kindKey(
    kind: FinancialKind,
  ): 'receivedCents' | 'confirmedReceivableCents' | 'forecastRenewalsCents' {
    if (kind === 'RECEIVED') return 'receivedCents';
    if (kind === 'CONFIRMED_RECEIVABLE') return 'confirmedReceivableCents';
    return 'forecastRenewalsCents';
  }

  private static assertPeriod(asOf: string, from: string, to: string): void {
    try {
      assertCivilDate(asOf, 'data-base');
      assertCivilDate(from, 'início do período');
      assertCivilDate(to, 'fim do período');
    } catch {
      throw new ValidationError('O período do dashboard é inválido.');
    }
    if (from > to) throw new ValidationError('O período do dashboard é inválido.');
  }

  private static addDays(date: string, days: number): string {
    const parsed = new Date(`${date}T00:00:00.000Z`);
    parsed.setUTCDate(parsed.getUTCDate() + days);
    return parsed.toISOString().slice(0, 10);
  }

  private static readonly financialQuery = `WITH RECURSIVE
    property_context AS (
      SELECT
        property.id AS property_unit_id,
        property.building_id,
        property.neighborhood,
        property.unit_number,
        building.name AS building_name
      FROM property_units property
      LEFT JOIN buildings building ON building.id = property.building_id
    ),
    received_events AS (
      SELECT
        (payment.reviewed_at AT TIME ZONE 'America/Sao_Paulo')::date AS event_date,
        'RECEIVED'::text AS kind,
        SUM(payment.amount_cents)::bigint AS amount_cents,
        context.*
      FROM payment_transactions payment
      JOIN invoices invoice ON invoice.id = payment.invoice_id
      JOIN contracts contract ON contract.id = invoice.contract_id
      JOIN property_context context ON context.property_unit_id = contract.property_unit_id
      WHERE payment.status = 'APPROVED'
        AND (payment.reviewed_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $2::date AND $3::date
      GROUP BY event_date, context.property_unit_id, context.building_id,
        context.neighborhood, context.unit_number, context.building_name
    ),
    approved_totals AS (
      SELECT invoice_id, COALESCE(SUM(amount_cents), 0)::bigint AS amount_cents
      FROM payment_transactions
      WHERE status = 'APPROVED'
      GROUP BY invoice_id
    ),
    receivable_events AS (
      SELECT
        invoice.due_date AS event_date,
        'CONFIRMED_RECEIVABLE'::text AS kind,
        SUM(invoice.total_value_cents - COALESCE(approved.amount_cents, 0))::bigint AS amount_cents,
        context.*
      FROM invoices invoice
      JOIN contracts contract ON contract.id = invoice.contract_id
      JOIN property_context context ON context.property_unit_id = contract.property_unit_id
      LEFT JOIN approved_totals approved ON approved.invoice_id = invoice.id
      WHERE invoice.status IN ('OPEN', 'PARTIALLY_PAID', 'OVERDUE')
        AND invoice.total_value_cents > COALESCE(approved.amount_cents, 0)
      GROUP BY invoice.due_date, context.property_unit_id, context.building_id,
        context.neighborhood, context.unit_number, context.building_name
    ),
    renewal_seed AS (
      SELECT
        contract.id AS contract_id,
        contract.property_unit_id,
        contract.monthly_base_value_cents,
        COALESCE((MAX(invoice.period_end) + 1), contract.move_in_date) AS period_start
      FROM contracts contract
      LEFT JOIN invoices invoice ON invoice.contract_id = contract.id
      WHERE contract.contract_type = 'MONTH_TO_MONTH'
        AND contract.status = 'ACTIVE'
      GROUP BY contract.id
    ),
    renewal_periods AS (
      SELECT
        seed.contract_id,
        seed.property_unit_id,
        seed.monthly_base_value_cents,
        seed.period_start,
        ((seed.period_start + INTERVAL '1 month')::date - 1) AS period_end
      FROM renewal_seed seed
      WHERE seed.period_start <= $4::date
      UNION ALL
      SELECT
        period.contract_id,
        period.property_unit_id,
        period.monthly_base_value_cents,
        (period.period_end + 1),
        (((period.period_end + 1) + INTERVAL '1 month')::date - 1)
      FROM renewal_periods period
      WHERE (period.period_end + 1) <= $4::date
    ),
    forecast_events AS (
      SELECT
        period.period_start AS event_date,
        'FORECAST_RENEWAL'::text AS kind,
        SUM(period.monthly_base_value_cents)::bigint AS amount_cents,
        context.*
      FROM renewal_periods period
      JOIN property_context context ON context.property_unit_id = period.property_unit_id
      WHERE period.period_start BETWEEN $1::date AND $4::date
        AND NOT EXISTS (
          SELECT 1 FROM invoices invoice
          WHERE invoice.contract_id = period.contract_id
            AND invoice.period_start = period.period_start
        )
      GROUP BY period.period_start, context.property_unit_id, context.building_id,
        context.neighborhood, context.unit_number, context.building_name
    )
    SELECT
      event_date AS "eventDate",
      kind,
      amount_cents AS "amountCents",
      property_unit_id AS "propertyUnitId",
      building_id AS "buildingId",
      neighborhood,
      unit_number AS "unitNumber",
      building_name AS "buildingName"
    FROM received_events
    UNION ALL SELECT event_date, kind, amount_cents, property_unit_id, building_id,
      neighborhood, unit_number, building_name FROM receivable_events
    UNION ALL SELECT event_date, kind, amount_cents, property_unit_id, building_id,
      neighborhood, unit_number, building_name FROM forecast_events`;
}
