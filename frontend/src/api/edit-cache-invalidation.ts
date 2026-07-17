import type { QueryClient, QueryKey } from '@tanstack/react-query';

const embeddedLedgerQueryKeys: readonly QueryKey[] = [
  ['contracts'],
  ['invoices'],
  ['invoice'],
  ['payments'],
];

const tenantEditQueryKeys: readonly QueryKey[] = [['tenants'], ...embeddedLedgerQueryKeys];
const buildingEditQueryKeys: readonly QueryKey[] = [['buildings'], ['properties'], ['property']];

async function invalidateQueryKeys(
  queryClient: QueryClient,
  queryKeys: readonly QueryKey[],
): Promise<void> {
  await Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export function invalidateTenantEditCaches(queryClient: QueryClient): Promise<void> {
  return invalidateQueryKeys(queryClient, tenantEditQueryKeys);
}

export function invalidateBuildingEditCaches(
  queryClient: QueryClient,
  neighborhoodChanged: boolean,
): Promise<void> {
  return invalidateQueryKeys(
    queryClient,
    neighborhoodChanged
      ? [...buildingEditQueryKeys, ...embeddedLedgerQueryKeys]
      : buildingEditQueryKeys,
  );
}
