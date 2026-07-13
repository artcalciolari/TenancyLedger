import { DataSource } from 'typeorm';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  it('normaliza agregados globais do banco e mantém uma única data de referência', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          total: 12,
          active: 7,
          expired: 3,
          terminated: 2,
          expiringNext30Days: 4,
        },
      ])
      .mockResolvedValueOnce([
        {
          total: 20,
          totalValueCents: '3000000',
          approvedAmountCents: '1250000',
          outstandingAmountCents: '1750000',
          overdueAmountCents: '450000',
          underReview: 5,
          submittedPayments: '8',
        },
      ]);
    const service = new DashboardService({ query } as unknown as DataSource);

    await expect(service.getSummary('2026-07-12')).resolves.toEqual({
      asOf: '2026-07-12',
      contracts: {
        total: 12,
        active: 7,
        expired: 3,
        terminated: 2,
        expiringNext30Days: 4,
      },
      invoices: {
        total: 20,
        totalValueCents: 3_000_000,
        approvedAmountCents: 1_250_000,
        outstandingAmountCents: 1_750_000,
        overdueAmountCents: 450_000,
        underReview: 5,
      },
      payments: { submitted: 8 },
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining("status <> 'TERMINATED'"), [
      '2026-07-12',
    ]);
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("WHEN invoice.due_date < $1::date THEN 'OVERDUE'"),
      ['2026-07-12'],
    );
  });

  it('retorna zeros quando as tabelas não produzem linha agregada', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const service = new DashboardService({ query } as unknown as DataSource);

    const result = await service.getSummary('2026-07-12');

    expect(result.contracts.total).toBe(0);
    expect(result.invoices.outstandingAmountCents).toBe(0);
    expect(result.payments.submitted).toBe(0);
  });
});
