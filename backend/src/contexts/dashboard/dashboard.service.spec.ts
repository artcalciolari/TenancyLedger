import { DataSource } from 'typeorm';
import { ValidationError } from '../../core/domain/errors/validation.error';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  it('normaliza os agregados e mantém os três conceitos financeiros disjuntos', async () => {
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
      ])
      .mockResolvedValueOnce([
        {
          eventDate: '2026-07-10',
          kind: 'RECEIVED',
          amountCents: '50000',
          propertyUnitId: '7fdf9cde-2961-4ed2-a3ae-eedce12a42ee',
          buildingId: null,
          buildingName: null,
          neighborhood: 'Centro',
          unitNumber: '2',
        },
        {
          eventDate: new Date('2026-07-10T00:00:00.000Z'),
          kind: 'CONFIRMED_RECEIVABLE',
          amountCents: 25000,
          propertyUnitId: '7fdf9cde-2961-4ed2-a3ae-eedce12a42ee',
          buildingId: null,
          buildingName: null,
          neighborhood: 'Centro',
          unitNumber: '2',
        },
        {
          eventDate: '2026-08-01',
          kind: 'FORECAST_RENEWAL',
          amountCents: 90000,
          propertyUnitId: 'a1594607-7840-4f91-a6ab-c844013d3df5',
          buildingId: '94aa5692-e8cd-476b-b5f4-6ca595d5cccd',
          buildingName: 'Edifício Sol',
          neighborhood: 'Jardins',
          unitNumber: '101',
        },
        {
          eventDate: '2026-07-10',
          kind: 'CONFIRMED_RECEIVABLE',
          amountCents: 5000,
          propertyUnitId: 'b26f4f2a-16d8-49c1-b314-19f5e0261598',
          buildingId: '94aa5692-e8cd-476b-b5f4-6ca595d5cccd',
          buildingName: 'Edifício Sol',
          neighborhood: 'Jardins',
          unitNumber: '102',
        },
      ]);
    const service = new DashboardService({ query } as unknown as DataSource);

    await expect(service.getSummary('2026-07-12', '2026-07-01', '2026-07-12')).resolves.toEqual({
      asOf: '2026-07-12',
      period: { from: '2026-07-01', to: '2026-07-12', forecastThrough: '2026-08-11' },
      financial: {
        receivedCents: 50_000,
        confirmedReceivableCents: 30_000,
        forecastRenewalsCents: 90_000,
        byProperty: [
          {
            propertyUnitId: '7fdf9cde-2961-4ed2-a3ae-eedce12a42ee',
            buildingId: null,
            buildingName: null,
            neighborhood: 'Centro',
            unitNumber: '2',
            receivedCents: 50_000,
            confirmedReceivableCents: 25_000,
            forecastRenewalsCents: 0,
          },
          {
            propertyUnitId: 'a1594607-7840-4f91-a6ab-c844013d3df5',
            buildingId: '94aa5692-e8cd-476b-b5f4-6ca595d5cccd',
            buildingName: 'Edifício Sol',
            neighborhood: 'Jardins',
            unitNumber: '101',
            receivedCents: 0,
            confirmedReceivableCents: 0,
            forecastRenewalsCents: 90_000,
          },
          {
            propertyUnitId: 'b26f4f2a-16d8-49c1-b314-19f5e0261598',
            buildingId: '94aa5692-e8cd-476b-b5f4-6ca595d5cccd',
            buildingName: 'Edifício Sol',
            neighborhood: 'Jardins',
            unitNumber: '102',
            receivedCents: 0,
            confirmedReceivableCents: 5_000,
            forecastRenewalsCents: 0,
          },
        ],
        byBuilding: [
          {
            buildingId: '94aa5692-e8cd-476b-b5f4-6ca595d5cccd',
            buildingName: 'Edifício Sol',
            neighborhood: 'Jardins',
            propertyUnitCount: 2,
            receivedCents: 0,
            confirmedReceivableCents: 5_000,
            forecastRenewalsCents: 90_000,
          },
          {
            buildingId: null,
            buildingName: null,
            neighborhood: 'Centro',
            propertyUnitCount: 1,
            receivedCents: 50_000,
            confirmedReceivableCents: 25_000,
            forecastRenewalsCents: 0,
          },
        ],
        daily: [
          {
            date: '2026-07-10',
            receivedCents: 50_000,
            confirmedReceivableCents: 30_000,
            forecastRenewalsCents: 0,
          },
          {
            date: '2026-08-01',
            receivedCents: 0,
            confirmedReceivableCents: 0,
            forecastRenewalsCents: 90_000,
          },
        ],
      },
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
    expect(query).toHaveBeenCalledTimes(3);
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("status IN ('ACTIVE', 'ENDING')"),
      ['2026-07-12'],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("WHEN invoice.due_date < $1::date THEN 'OVERDUE'"),
      ['2026-07-12'],
    );
    expect(query).toHaveBeenNthCalledWith(3, expect.stringContaining("'FORECAST_RENEWAL'::text"), [
      '2026-07-12',
      '2026-07-01',
      '2026-07-12',
      '2026-08-11',
    ]);
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("payment.status = 'APPROVED'"),
      ['2026-07-12', '2026-07-01', '2026-07-12', '2026-08-11'],
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("invoice.status IN ('OPEN', 'PARTIALLY_PAID', 'OVERDUE')"),
      ['2026-07-12', '2026-07-01', '2026-07-12', '2026-08-11'],
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('invoice.total_value_cents - COALESCE(approved.amount_cents, 0)'),
      ['2026-07-12', '2026-07-01', '2026-07-12', '2026-08-11'],
    );
    expect(query).toHaveBeenNthCalledWith(3, expect.stringContaining('NOT EXISTS'), [
      '2026-07-12',
      '2026-07-01',
      '2026-07-12',
      '2026-08-11',
    ]);
    expect(query).not.toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('invoice.due_date BETWEEN $2::date AND $3::date'),
      expect.anything(),
    );
  });

  it('retorna zeros quando as tabelas não produzem linhas', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const service = new DashboardService({ query } as unknown as DataSource);

    const result = await service.getSummary('2026-07-12');

    expect(result.period).toEqual({
      from: '2026-07-01',
      to: '2026-07-12',
      forecastThrough: '2026-08-11',
    });
    expect(result.contracts.total).toBe(0);
    expect(result.invoices.outstandingAmountCents).toBe(0);
    expect(result.payments.submitted).toBe(0);
    expect(result.financial).toEqual({
      receivedCents: 0,
      confirmedReceivableCents: 0,
      forecastRenewalsCents: 0,
      byProperty: [],
      byBuilding: [],
      daily: [],
    });
  });

  it('rejeita datas malformadas ou período invertido antes de consultar o banco', async () => {
    const query = jest.fn();
    const service = new DashboardService({ query } as unknown as DataSource);

    await expect(service.getSummary('2026-07-12', '2026-07-20', '2026-07-01')).rejects.toEqual(
      new ValidationError('O período do dashboard é inválido.'),
    );
    await expect(service.getSummary('12/07/2026')).rejects.toBeInstanceOf(ValidationError);
    expect(query).not.toHaveBeenCalled();
  });
});
