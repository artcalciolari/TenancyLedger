import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router';

const allowedLimits = new Set([20, 50, 100]);

interface PaginationParamsOptions {
  pageParam?: string;
  limitParam?: string;
  normalize?: boolean;
}

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

function parseLimit(value: string | null): number {
  const limit = Number(value);
  return allowedLimits.has(limit) ? limit : 20;
}

export function usePaginationParams(options: PaginationParamsOptions = {}) {
  const { pageParam = 'page', limitParam = 'limit', normalize = true } = options;
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get(pageParam));
  const limit = parseLimit(searchParams.get(limitParam));

  useEffect(() => {
    if (!normalize) return;
    const rawPage = searchParams.get(pageParam);
    const rawLimit = searchParams.get(limitParam);
    if (
      (rawPage === null || rawPage === String(page)) &&
      (rawLimit === null || rawLimit === String(limit))
    ) {
      return;
    }
    const normalizedParams = new URLSearchParams(searchParams);
    normalizedParams.set(pageParam, String(page));
    normalizedParams.set(limitParam, String(limit));
    setSearchParams(normalizedParams, { replace: true });
  }, [limit, limitParam, normalize, page, pageParam, searchParams, setSearchParams]);

  const setPagination = useCallback(
    (nextPage: number, nextLimit: number) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set(pageParam, String(nextPage));
        next.set(limitParam, String(nextLimit));
        return next;
      });
    },
    [limitParam, pageParam, setSearchParams],
  );

  return { page, limit, setPagination };
}
