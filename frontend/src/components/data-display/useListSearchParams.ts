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
  hasFiltersKeys?: readonly FilterKey<T>[];
  clearFilterKeys?: readonly FilterKey<T>[];
  pageParam?: string;
  limitParam?: string;
  paramNames?: Partial<Record<keyof T & string, string>>;
  parse: (searchParams: URLSearchParams, page: number, limit: number) => T;
}

function serialized(value: unknown): string | undefined {
  if (typeof value === 'string') return value === '' ? undefined : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

export function useListSearchParams<T extends ListFilters>(config: ListSearchConfig<T>) {
  const { page, limit, setPagination } = usePaginationParams({
    pageParam: config.pageParam,
    limitParam: config.limitParam,
    normalize: false,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const logicalSearchParams = useMemo(() => {
    const mapped = new URLSearchParams(searchParamsKey);
    for (const key of config.filterKeys) {
      const paramName = config.paramNames?.[key] ?? key;
      if (paramName !== key) mapped.delete(key);
      const value = searchParams.get(paramName);
      if (value === null) mapped.delete(key);
      else mapped.set(key, value);
    }
    return mapped;
  }, [config.filterKeys, config.paramNames, searchParams, searchParamsKey]);
  const filters = useMemo(
    () => config.parse(logicalSearchParams, page, limit),
    [config, limit, logicalSearchParams, page],
  );
  const normalizedEntries = useMemo(
    () =>
      config.filterKeys.map(
        (key) => [config.paramNames?.[key] ?? key, serialized(filters[key]), key] as const,
      ),
    [config.filterKeys, config.paramNames, filters],
  );

  useEffect(() => {
    const next = new URLSearchParams(searchParamsKey);
    let changed = false;
    normalizedEntries.forEach(([paramName, value, key]) => {
      if (paramName !== key && next.has(key)) {
        next.delete(key);
        changed = true;
      }
      const currentValue = next.get(paramName);
      if (currentValue !== null && value === undefined) {
        next.delete(paramName);
        changed = true;
      } else if (value !== undefined && currentValue !== value) {
        next.set(paramName, value);
        changed = true;
      }
    });
    const pageParam = config.pageParam ?? 'page';
    const limitParam = config.limitParam ?? 'limit';
    if (next.has(pageParam) && next.get(pageParam) !== String(page)) {
      next.set(pageParam, String(page));
      changed = true;
    }
    if (next.has(limitParam) && next.get(limitParam) !== String(limit)) {
      next.set(limitParam, String(limit));
      changed = true;
    }
    if (changed) setSearchParams(next, { replace: true });
  }, [
    config.limitParam,
    config.pageParam,
    limit,
    normalizedEntries,
    page,
    searchParamsKey,
    setSearchParams,
  ]);

  const updateFilters = useCallback(
    (values: FilterUpdate<T>, options: FilterUpdateOptions = {}) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          const entries = Object.entries(values) as [
            keyof T & string,
            string | number | boolean | undefined,
          ][];
          entries.forEach(([key, value]) => {
            const paramName =
              key === 'page'
                ? (config.pageParam ?? 'page')
                : key === 'limit'
                  ? (config.limitParam ?? 'limit')
                  : (config.paramNames?.[key] ?? key);
            if (value === undefined || value === '') next.delete(paramName);
            else next.set(paramName, String(value));
          });
          if (!Object.hasOwn(values, 'page')) next.set(config.pageParam ?? 'page', '1');
          return next;
        },
        { flushSync: true, replace: options.replace },
      );
    },
    [config.limitParam, config.pageParam, config.paramNames, setSearchParams],
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
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      for (const key of config.clearFilterKeys ?? config.filterKeys) {
        next.delete(config.paramNames?.[key] ?? key);
      }
      next.set(config.pageParam ?? 'page', '1');
      if (current.get(config.limitParam ?? 'limit') !== null) {
        next.set(config.limitParam ?? 'limit', String(limit));
      }
      return next;
    });
  }, [
    config.clearFilterKeys,
    config.filterKeys,
    config.limitParam,
    config.pageParam,
    config.paramNames,
    limit,
    setSearchParams,
  ]);

  return {
    applyFilters,
    clearFilters,
    filters,
    hasFilters: (config.hasFiltersKeys ?? config.filterKeys).some(
      (key) => serialized(filters[key]) !== undefined,
    ),
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
