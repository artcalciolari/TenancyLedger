import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContractView, Paginated } from '../../api/contract';
import { contractsApi } from './api';

const contract: ContractView = {
  id: '0299d386-f780-4592-9537-8dac4c65ea54',
  tenantId: '7d9cdddc-8661-44ee-af5d-b420099509ca',
  propertyUnitId: 'd0208cb2-3688-4778-a056-93cb82e31166',
  tenant: {
    id: '7d9cdddc-8661-44ee-af5d-b420099509ca',
    name: 'Maria da Silva',
    cpf: '***.***.***-09',
    email: 'l***@example.com',
    mobilePhone: '(**) *****-9999',
    profession: 'Engenheiro civil',
    civilStatus: 'SINGLE',
  },
  propertyUnit: {
    id: 'd0208cb2-3688-4778-a056-93cb82e31166',
    neighborhood: 'Centro',
    unitNumber: '101-A',
    type: 'APARTMENT',
  },
  moveInDate: '2026-07-12',
  endDate: '2027-07-11',
  monthlyBaseValueCents: 150_000,
  durationInMonths: 12,
  billingDay: 10,
  contractType: 'FIXED_TERM',
  isRenewable: true,
  status: 'ACTIVE',
  statusReason: null,
  statusChangedAt: '2026-07-12T10:00:00.000Z',
  paidThroughDate: null,
  nextRenewalDate: null,
  badges: [],
  createdAt: '2026-07-12T10:00:00.000Z',
  updatedAt: '2026-07-12T10:00:00.000Z',
};

afterEach(() => vi.unstubAllGlobals());

describe('contractsApi', () => {
  it('envia somente os filtros suportados na listagem', async () => {
    const payload: Paginated<ContractView> = {
      data: [contract],
      meta: { page: 2, limit: 20, total: 1, totalPages: 1 },
    };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      contractsApi.list({ page: 2, limit: 20, status: 'ACTIVE', tenantId: contract.tenantId }),
    ).resolves.toEqual(payload);
    const request = fetchMock.mock.calls[0]?.[0];
    expect(request).toBeInstanceOf(Request);
    if (!(request instanceof Request)) throw new TypeError('Request esperado.');
    expect(new URL(request.url).pathname + new URL(request.url).search).toBe(
      `/api/contracts?page=2&limit=20&status=ACTIVE&tenantId=${contract.tenantId}`,
    );
  });

  it('renova com PATCH e corpo JSON', async () => {
    const renewed = { ...contract, durationInMonths: 18, endDate: '2028-01-11' };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(renewed), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(contractsApi.renew(contract.id, { extraMonths: 6 })).resolves.toEqual(renewed);
    const request = fetchMock.mock.calls[0]?.[0];
    expect(request).toBeInstanceOf(Request);
    if (!(request instanceof Request)) throw new TypeError('Request esperado.');
    expect(request.method).toBe('PATCH');
    await expect(request.clone().json()).resolves.toEqual({ extraMonths: 6 });
    expect(request.headers.get('content-type')).toBe('application/json');
  });
});
