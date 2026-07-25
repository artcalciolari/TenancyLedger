import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import {
  usePortfolioBuildingsSearchParams,
  usePortfolioRoomsSearchParams,
  usePortfolioTab,
} from './search-params';

function wrapperAt(entry: string) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>;
  };
}

function currentParams(search: string): URLSearchParams {
  return new URLSearchParams(search);
}

describe('portfolio search params', () => {
  it('defaults an unknown tab and normalizes building filters in the URL', async () => {
    const { result } = renderHook(
      () => {
        const tab = usePortfolioTab();
        const buildings = usePortfolioBuildingsSearchParams('2026-07-24');
        return { tab, buildings, search: useLocation().search };
      },
      {
        wrapper: wrapperAt(
          '/portfolio?tab=legacy&buildingsPage=0&buildingsLimit=999&buildingsQ=%20Aurora%20&buildingVacancy=INVALID',
        ),
      },
    );

    expect(result.current.tab.tab).toBe('buildings');
    expect(result.current.buildings.filters).toEqual({
      page: 1,
      limit: 20,
      q: 'Aurora',
      date: '2026-07-24',
      vacancy: undefined,
    });

    await waitFor(() => {
      const params = currentParams(result.current.search);
      expect(params.get('tab')).toBe('legacy');
      expect(params.get('date')).toBe('2026-07-24');
      expect(params.get('buildingsPage')).toBe('1');
      expect(params.get('buildingsLimit')).toBe('20');
      expect(params.get('buildingsQ')).toBe('Aurora');
      expect(params.has('buildingVacancy')).toBe(false);
    });
  });

  it('keeps shared date and independent filters when switching tabs', async () => {
    const { result } = renderHook(
      () => {
        const tab = usePortfolioTab();
        const buildings = usePortfolioBuildingsSearchParams('2026-07-24');
        const rooms = usePortfolioRoomsSearchParams('2026-07-24');
        return { tab, buildings, rooms, search: useLocation().search };
      },
      {
        wrapper: wrapperAt(
          '/portfolio?tab=buildings&date=2026-08-01&buildingsQ=aurora&buildingVacancy=FULL&buildingsPage=2&roomsQ=101&roomStatus=VACANT&roomsPage=3',
        ),
      },
    );

    act(() => result.current.tab.setTab('rooms'));

    await waitFor(() => {
      const params = currentParams(result.current.search);
      expect(params.get('tab')).toBe('rooms');
      expect(params.get('date')).toBe('2026-08-01');
      expect(params.get('buildingsQ')).toBe('aurora');
      expect(params.get('buildingVacancy')).toBe('FULL');
      expect(params.get('buildingsPage')).toBe('2');
      expect(params.get('roomsQ')).toBe('101');
      expect(params.get('roomStatus')).toBe('VACANT');
      expect(params.get('roomsPage')).toBe('3');
    });
  });

  it('clears room filters without removing building filters or shared date', async () => {
    const { result } = renderHook(
      () => {
        const rooms = usePortfolioRoomsSearchParams('2026-07-24');
        return { rooms, search: useLocation().search };
      },
      {
        wrapper: wrapperAt(
          '/portfolio?tab=rooms&date=2026-08-01&buildingsQ=aurora&buildingVacancy=WITH_VACANCY&roomBuildingId=3d6f0c9e-3c9a-4d3b-9d0a-8f6e5c1a2b3c&roomStatus=VACANT&roomsQ=101&roomsPage=4&roomsLimit=50',
        ),
      },
    );

    act(() => result.current.rooms.clearFilters());

    await waitFor(() => {
      const params = currentParams(result.current.search);
      expect(params.get('tab')).toBe('rooms');
      expect(params.get('date')).toBe('2026-08-01');
      expect(params.get('buildingsQ')).toBe('aurora');
      expect(params.get('buildingVacancy')).toBe('WITH_VACANCY');
      expect(params.get('roomsPage')).toBe('1');
      expect(params.get('roomsLimit')).toBe('50');
      expect(params.has('roomsQ')).toBe(false);
      expect(params.has('roomBuildingId')).toBe(false);
      expect(params.has('roomStatus')).toBe(false);
    });
  });
});
