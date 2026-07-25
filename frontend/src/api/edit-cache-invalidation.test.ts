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

  it('invalida os prédios e quartos ao editar um prédio', async () => {
    const { invalidateQueries, queryClient } = invalidationSpy();

    await invalidateBuildingEditCaches(queryClient);

    expect(invalidateQueries).toHaveBeenCalledTimes(3);
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, { queryKey: ['buildings'] });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, { queryKey: ['rooms'] });
    expect(invalidateQueries).toHaveBeenNthCalledWith(3, { queryKey: ['room'] });
  });
});
