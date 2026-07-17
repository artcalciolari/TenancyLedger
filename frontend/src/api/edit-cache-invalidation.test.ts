import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import {
  invalidateBuildingEditCaches,
  invalidateTenantEditCaches,
} from './edit-cache-invalidation';

function invalidationSpy() {
  const queryClient = new QueryClient();
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
  return { invalidateQueries, queryClient };
}

describe('edit cache invalidation', () => {
  it('invalida somente as famílias que incorporam um locatário editado', async () => {
    const { invalidateQueries, queryClient } = invalidationSpy();

    await invalidateTenantEditCaches(queryClient);

    expect(invalidateQueries).toHaveBeenCalledTimes(5);
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, { queryKey: ['tenants'] });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, { queryKey: ['contracts'] });
    expect(invalidateQueries).toHaveBeenNthCalledWith(3, { queryKey: ['invoices'] });
    expect(invalidateQueries).toHaveBeenNthCalledWith(4, { queryKey: ['invoice'] });
    expect(invalidateQueries).toHaveBeenNthCalledWith(5, { queryKey: ['payments'] });
  });

  it('preserva as invalidações atuais do prédio sem tocar contratos quando o bairro não muda', async () => {
    const { invalidateQueries, queryClient } = invalidationSpy();

    await invalidateBuildingEditCaches(queryClient, false);

    expect(invalidateQueries).toHaveBeenCalledTimes(3);
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, { queryKey: ['buildings'] });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, { queryKey: ['properties'] });
    expect(invalidateQueries).toHaveBeenNthCalledWith(3, { queryKey: ['property'] });
  });

  it('invalida dados financeiros embutidos somente quando o bairro do prédio muda', async () => {
    const { invalidateQueries, queryClient } = invalidationSpy();

    await invalidateBuildingEditCaches(queryClient, true);

    expect(invalidateQueries).toHaveBeenCalledTimes(7);
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, { queryKey: ['buildings'] });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, { queryKey: ['properties'] });
    expect(invalidateQueries).toHaveBeenNthCalledWith(3, { queryKey: ['property'] });
    expect(invalidateQueries).toHaveBeenNthCalledWith(4, { queryKey: ['contracts'] });
    expect(invalidateQueries).toHaveBeenNthCalledWith(5, { queryKey: ['invoices'] });
    expect(invalidateQueries).toHaveBeenNthCalledWith(6, { queryKey: ['invoice'] });
    expect(invalidateQueries).toHaveBeenNthCalledWith(7, { queryKey: ['payments'] });
  });
});
