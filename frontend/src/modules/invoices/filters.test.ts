import { describe, expect, it } from 'vitest';
import { parseInvoiceFilters } from './filters';

const contractId = '123e4567-e89b-42d3-a456-426614174000';

describe('parseInvoiceFilters', () => {
  it('aceita filtros válidos, inclusive UUID v4 completo', () => {
    expect(
      parseInvoiceFilters(
        new URLSearchParams({
          page: '2',
          limit: '50',
          status: 'OVERDUE',
          competence: '2026-07',
          contractId,
        }),
      ),
    ).toEqual({ page: 2, limit: 50, status: 'OVERDUE', competence: '2026-07', contractId });
  });

  it('não envia UUID incompleto nem filtros desconhecidos à API', () => {
    expect(
      parseInvoiceFilters(
        new URLSearchParams({ page: '-1', limit: '1000', status: 'UNKNOWN', contractId: '123e' }),
      ),
    ).toEqual({
      page: 1,
      limit: 20,
      status: undefined,
      competence: undefined,
      contractId: undefined,
    });
  });

  it('descarta competência e datas civis inválidas', () => {
    expect(
      parseInvoiceFilters(
        new URLSearchParams({
          competence: '2026-13',
          dueFrom: '2026-02-30',
          dueTo: 'amanhã',
        }),
      ),
    ).toMatchObject({ competence: undefined, dueFrom: undefined, dueTo: undefined });
  });
});
