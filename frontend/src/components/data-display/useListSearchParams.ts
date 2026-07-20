import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { usePaginationParams } from './usePaginationParams';

interface ListFilters {
  page: number;
  limit: number;
}
type FilterKey<T extends ListFilters> = Exclude<keyof T, 'page' | 'limit'> & string;
type FilterUpdate<T extends ListFilters> = Partial<
  Record<keyof T & string, string | number | boolean | undefined>
>;
interface FilterUpdateOptions {
  replace?: boolean;
}

export interface ListSearchConfig<T extends ListFilters> {
  filterKeys: readonly FilterKey<T>[];
  parse: (searchParams: URLSearchParams, page: number, limit: number) => T;
}

function serialized(value: unknown): string | undefined {
  if (typeof value === 'string') return value === '' ? undefined : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

export function useListSearchParams<T extends ListFilters>(config: ListSearchConfig<T>) {
  const { page, limit, setPagination } = usePaginationParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const filters = useMemo(
    () => config.parse(new URLSearchParams(searchParamsKey), page, limit),
    [config, limit, page, searchParamsKey],
  );
  const normalizedEntries = useMemo(
    () => config.filterKeys.map((key) => [key, serialized(filters[key])] as const),
    [config.filterKeys, filters],
  );

  useEffect(() => {
    const next = new URLSearchParams(searchParamsKey);
    let changed = false;
    normalizedEntries.forEach(([key, value]) => {
      const current = next.get(key);
      if (current !== null && value === undefined) {
        next.delete(key);
        changed = true;
      } else if (value !== undefined && current !== value) {
        next.set(key, value);
        changed = true;
      }
    });
    if (changed) setSearchParams(next, { replace: true });
  }, [normalizedEntries, searchParamsKey, setSearchParams]);

  const updateFilters = useCallback(
    (values: FilterUpdate<T>, options: FilterUpdateOptions = {}) => {
      const next = new URLSearchParams(searchParamsKey);
      Object.entries(values).forEach(([key, value]) => {
        if (value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      });
      if (!Object.hasOwn(values, 'page')) next.set('page', '1');
      setSearchParams(next, { replace: options.replace });
    },
    [searchParamsKey, setSearchParams],
  );

  const applyFilters = useCallback(
    (formData: FormData, keys: readonly FilterKey<T>[] = config.filterKeys) => {
      const values: FilterUpdate<T> = {};
      keys.forEach((key) => {
        const value = formData.get(key);
        values[key] = typeof value === 'string' ? value : undefined;
      });
      updateFilters(values);
    },
    [config.filterKeys, updateFilters],
  );

  const clearFilters = useCallback(() => {
    setSearchParams({ page: '1', limit: String(limit) });
  }, [limit, setSearchParams]);

  return {
    applyFilters,
    clearFilters,
    filters,
    hasFilters: config.filterKeys.some((key) => serialized(filters[key]) !== undefined),
    limit,
    page,
    searchParamsKey,
    setPagination,
    updateFilters,
  };
}

export function useListPageRange(
  pagination: Pick<ReturnType<typeof usePaginationParams>, 'page' | 'limit' | 'setPagination'> & {
    updateFilters?: (values: { page: number }, options?: FilterUpdateOptions) => void;
  },
  totalPages: number | undefined,
  options: { resetTo?: 'first' | 'last'; preserveLimitParam?: boolean } = {},
): boolean {
  const { page, limit, setPagination, updateFilters } = pagination;
  const { preserveLimitParam = false, resetTo = 'first' } = options;
  const lastPage = Math.max(1, Math.trunc(totalPages ?? 1));
  const pageOutOfRange = totalPages !== undefined && page > lastPage;

  useEffect(() => {
    if (!pageOutOfRange) return;
    const nextPage = resetTo === 'last' ? lastPage : 1;
    if (preserveLimitParam && updateFilters) {
      updateFilters({ page: nextPage }, { replace: true });
    } else {
      setPagination(nextPage, limit);
    }
  }, [lastPage, limit, pageOutOfRange, preserveLimitParam, resetTo, setPagination, updateFilters]);

  return pageOutOfRange;
}
