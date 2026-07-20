import { describe, expect, it } from 'vitest';
import { isUuid, parseContractFilters } from './filters';

describe('parseContractFilters', () => {
  it('lê somente filtros aceitos pela API', () => {
    const search = new URLSearchParams({
      page: '2',
      limit: '50',
      status: 'ACTIVE',
      tenantId: '7d9cdddc-8661-44ee-af5d-b420099509ca',
      propertyUnitId: 'd0208cb2-3688-4778-a056-93cb82e31166',
    });
    expect(parseContractFilters(search)).toEqual({
      page: 2,
      limit: 50,
      status: 'ACTIVE',
      tenantId: search.get('tenantId'),
      propertyUnitId: search.get('propertyUnitId'),
    });
  });

  it('normaliza paginação e ignora enum e UUID inválidos', () => {
    expect(
      parseContractFilters(
        new URLSearchParams({ page: '-1', limit: '35', status: 'DRAFT', tenantId: 'x' }),
      ),
    ).toEqual({
      page: 1,
      limit: 20,
      status: undefined,
      tenantId: undefined,
      propertyUnitId: undefined,
    });
  });

  it('limita a busca e descarta datas civis impossíveis', () => {
    const filters = parseContractFilters(
      new URLSearchParams({ q: 'x'.repeat(140), moveInFrom: '2026-02-31' }),
    );
    expect(filters.q).toHaveLength(120);
    expect(filters.moveInFrom).toBeUndefined();
  });

  it('ativa somente badges conhecidos', () => {
    expect(parseContractFilters(new URLSearchParams({ badge: 'RENEWAL_DUE' })).badge).toBe(
      'RENEWAL_DUE',
    );
    expect(parseContractFilters(new URLSearchParams({ badge: 'UNKNOWN' })).badge).toBeUndefined();
  });

  it('lê renewalAttention apenas quando explicitamente true', () => {
    expect(
      parseContractFilters(new URLSearchParams({ renewalAttention: 'true' })).renewalAttention,
    ).toBe(true);
    expect(
      parseContractFilters(new URLSearchParams({ renewalAttention: 'false' })).renewalAttention,
    ).toBeUndefined();
    expect(parseContractFilters(new URLSearchParams()).renewalAttention).toBeUndefined();
  });

  it('combina renewalAttention com badge para a interseção natural dos filtros', () => {
    const filters = parseContractFilters(
      new URLSearchParams({ renewalAttention: 'true', badge: 'PAYMENT_OVERDUE' }),
    );
    expect(filters.renewalAttention).toBe(true);
    expect(filters.badge).toBe('PAYMENT_OVERDUE');
  });
});

describe('isUuid', () => {
  it('aceita UUID v4 e recusa outros valores', () => {
    expect(isUuid('7d9cdddc-8661-44ee-af5d-b420099509ca')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
  });
});
