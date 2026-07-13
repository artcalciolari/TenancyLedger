import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router';

const allowedLimits = new Set([20, 50, 100]);

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

function parseLimit(value: string | null): number {
  const limit = Number(value);
  return allowedLimits.has(limit) ? limit : 20;
}

export function usePaginationParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get('page'));
  const limit = parseLimit(searchParams.get('limit'));

  useEffect(() => {
    const rawPage = searchParams.get('page');
    const rawLimit = searchParams.get('limit');
    if (
      (rawPage === null || rawPage === String(page)) &&
      (rawLimit === null || rawLimit === String(limit))
    ) {
      return;
    }
    const normalized = new URLSearchParams(searchParams);
    normalized.set('page', String(page));
    normalized.set('limit', String(limit));
    setSearchParams(normalized, { replace: true });
  }, [limit, page, searchParams, setSearchParams]);

  const setPagination = useCallback(
    (nextPage: number, nextLimit: number) => {
      const next = new URLSearchParams(searchParams);
      next.set('page', String(nextPage));
      next.set('limit', String(nextLimit));
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  return { page, limit, setPagination };
}
