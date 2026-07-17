import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router';
import { describe, expect, it } from 'vitest';
import {
  type ListSearchConfig,
  useListPageRange,
  useListSearchParams,
} from './useListSearchParams';

interface TestFilters {
  page: number;
  limit: number;
  q?: string;
  kind?: 'a' | 'b';
}

const config: ListSearchConfig<TestFilters> = {
  filterKeys: ['q', 'kind'],
  parse: (searchParams, page, limit) => {
    const rawQ = searchParams.get('q')?.trim();
    const rawKind = searchParams.get('kind');
    return {
      page,
      limit,
      q: rawQ ? rawQ.slice(0, 5) : undefined,
      kind: rawKind === 'a' || rawKind === 'b' ? rawKind : undefined,
    };
  },
};

function wrapperAt(entry: string) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>;
  };
}

function currentParams(search: string): URLSearchParams {
  return new URLSearchParams(search);
}

describe('useListSearchParams', () => {
  it('normaliza paginação, enum e maxLength na URL', async () => {
    const { result } = renderHook(
      () => {
        const list = useListSearchParams(config);
        return { list, search: useLocation().search };
      },
      { wrapper: wrapperAt('/?page=invalid&limit=999&q=%20abcdef%20&kind=x') },
    );

    expect(result.current.list.filters).toEqual({
      page: 1,
      limit: 20,
      q: 'abcde',
      kind: undefined,
    });
    await waitFor(() => {
      const params = currentParams(result.current.search);
      expect(params.get('page')).toBe('1');
      expect(params.get('limit')).toBe('20');
      expect(params.get('q')).toBe('abcde');
      expect(params.has('kind')).toBe(false);
    });
  });

  it('aplica FormData preservando limit e reiniciando page', async () => {
    const { result } = renderHook(
      () => {
        const list = useListSearchParams(config);
        return { list, search: useLocation().search };
      },
      { wrapper: wrapperAt('/?page=3&limit=50&kind=a') },
    );
    const formData = new FormData();
    formData.set('q', '  hello world ');
    formData.set('kind', 'b');

    act(() => result.current.list.applyFilters(formData));

    await waitFor(() => {
      const params = currentParams(result.current.search);
      expect(params.get('page')).toBe('1');
      expect(params.get('limit')).toBe('50');
      expect(params.get('q')).toBe('hello');
      expect(params.get('kind')).toBe('b');
    });
  });

  it('usa PUSH em uma atualização comum de filtros', async () => {
    const { result } = renderHook(
      () => {
        const list = useListSearchParams(config);
        return { list, navigationType: useNavigationType(), search: useLocation().search };
      },
      { wrapper: wrapperAt('/?page=3&limit=50&kind=a') },
    );

    act(() => result.current.list.updateFilters({ q: 'hello' }));

    await waitFor(() => {
      const params = currentParams(result.current.search);
      expect(params.get('page')).toBe('1');
      expect(params.get('limit')).toBe('50');
      expect(params.get('q')).toBe('hello');
      expect(params.get('kind')).toBe('a');
      expect(result.current.navigationType).toBe('PUSH');
    });
  });

  it('limpa filtros e mantém o limite atual', async () => {
    const { result } = renderHook(
      () => {
        const list = useListSearchParams(config);
        return { list, search: useLocation().search };
      },
      { wrapper: wrapperAt('/?page=4&limit=100&q=teste&kind=a') },
    );

    act(() => result.current.list.clearFilters());

    await waitFor(() => {
      const params = currentParams(result.current.search);
      expect(params.toString()).toBe('page=1&limit=100');
    });
  });

  it('reinicia a página quando ela fica fora do total disponível', async () => {
    const { result } = renderHook(
      () => {
        const list = useListSearchParams(config);
        const pageOutOfRange = useListPageRange(list, 2);
        return {
          list,
          navigationType: useNavigationType(),
          pageOutOfRange,
          search: useLocation().search,
        };
      },
      { wrapper: wrapperAt('/?page=5&limit=20') },
    );

    await waitFor(() => {
      expect(currentParams(result.current.search).get('page')).toBe('1');
      expect(result.current.pageOutOfRange).toBe(false);
      expect(result.current.navigationType).toBe('PUSH');
    });
  });

  it('pode recuar para a última página sem materializar um limit ausente', async () => {
    const { result } = renderHook(
      () => {
        const list = useListSearchParams(config);
        useListPageRange(list, 2, { resetTo: 'last', preserveLimitParam: true });
        return { navigationType: useNavigationType(), search: useLocation().search };
      },
      { wrapper: wrapperAt('/?page=5&q=teste&kind=a') },
    );

    await waitFor(() => {
      const params = currentParams(result.current.search);
      expect(params.get('page')).toBe('2');
      expect(params.has('limit')).toBe(false);
      expect(params.get('q')).toBe('teste');
      expect(params.get('kind')).toBe('a');
      expect(result.current.navigationType).toBe('REPLACE');
    });
  });
});
