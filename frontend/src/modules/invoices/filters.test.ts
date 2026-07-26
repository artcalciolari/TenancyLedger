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

  it('aceita todos os filtros opcionais válidos', () => {
    const tenantId = '7d9cdddc-8661-44ee-af5d-b420099509ca';
    const roomId = 'd0208cb2-3688-4778-a056-93cb82e31166';
    expect(
      parseInvoiceFilters(
        new URLSearchParams({
          q: 'locatário',
          dueFrom: '2026-07-01',
          dueTo: '2026-07-31',
          tenantId,
          roomId,
          paymentMethod: 'PIX',
          paymentStatus: 'APPROVED',
        }),
      ),
    ).toMatchObject({
      q: 'locatário',
      dueFrom: '2026-07-01',
      dueTo: '2026-07-31',
      tenantId,
      roomId,
      paymentMethod: 'PIX',
      paymentStatus: 'APPROVED',
    });
  });

  it('descarta filtros opcionais vazios, inválidos ou fora do limite', () => {
    expect(
      parseInvoiceFilters(
        new URLSearchParams({
          q: '',
          dueFrom: '2026-01-32',
          dueTo: '2026/07/12',
          tenantId: 'invalid',
          roomId: 'invalid',
          paymentMethod: 'CARD',
          paymentStatus: 'UNKNOWN',
        }),
      ),
    ).toMatchObject({
      q: undefined,
      dueFrom: undefined,
      dueTo: undefined,
      tenantId: undefined,
      roomId: undefined,
      paymentMethod: undefined,
      paymentStatus: undefined,
    });
  });
});
