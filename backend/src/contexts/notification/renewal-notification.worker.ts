import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { civilDateInTimeZone } from '../../core/domain/civil-date';

@Injectable()
export class RenewalNotificationWorker {
  constructor(private readonly dataSource: DataSource) {}

  @Cron('0 8 * * *', { timeZone: 'America/Sao_Paulo' })
  async handleCron(): Promise<void> {
    await this.run();
  }

  async run(asOf = civilDateInTimeZone(new Date())): Promise<number> {
    const result = await this.dataSource.query<Array<{ inserted: string | number }>>(
      `WITH paid_through AS (
        SELECT
          contract.id AS contract_id,
          (MAX(invoice.period_end) FILTER (WHERE invoice.status = 'PAID') + 1)
            AS next_renewal_date
        FROM contracts contract
        LEFT JOIN invoices invoice ON invoice.contract_id = contract.id
        WHERE contract.contract_type = 'MONTH_TO_MONTH'
          AND contract.status = 'ACTIVE'
        GROUP BY contract.id
      ), candidates AS (
        SELECT
          'RENEWAL_DUE'::varchar AS type,
          'Renovação próxima'::varchar AS title,
          ('O contrato possui renovação prevista para ' ||
            to_char(paid.next_renewal_date, 'DD/MM/YYYY') || '.')::varchar AS message,
          'CONTRACT'::varchar AS resource_type,
          paid.contract_id AS resource_id,
          ('renewal-due:' || paid.contract_id::text || ':' || paid.next_renewal_date::text)::varchar
            AS deduplication_key
        FROM paid_through paid
        WHERE paid.next_renewal_date <= ($1::date + INTERVAL '3 days')::date
        UNION ALL
        SELECT
          'PAYMENT_OVERDUE'::varchar,
          'Pagamento em atraso'::varchar,
          ('A fatura com vencimento em ' || to_char(invoice.due_date, 'DD/MM/YYYY') ||
            ' continua em aberto.')::varchar,
          'INVOICE'::varchar,
          invoice.id,
          ('payment-overdue:' || invoice.id::text || ':' || invoice.due_date::text)::varchar
        FROM invoices invoice
        WHERE invoice.status = 'OVERDUE'
      ), inserted AS (
        INSERT INTO notifications (
          user_id, type, title, message, resource_type, resource_id, deduplication_key
        )
        SELECT
          users.id,
          candidates.type,
          candidates.title,
          candidates.message,
          candidates.resource_type,
          candidates.resource_id,
          candidates.deduplication_key
        FROM candidates
        CROSS JOIN users
        WHERE users.active = true
          AND users.role IN ('ADMIN'::user_role, 'MANAGER'::user_role)
        ON CONFLICT (user_id, deduplication_key)
          WHERE deduplication_key IS NOT NULL
          DO NOTHING
        RETURNING 1
      )
      SELECT COUNT(*)::int AS inserted FROM inserted`,
      [asOf],
    );
    return Number(result[0]?.inserted ?? 0);
  }
}
