import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type {
  BuildingListFilters,
  BuildingVacancyFilter,
  RoomAvailabilityStatus,
  RoomListFilters,
} from '../../api/contract';
import {
  type ListSearchConfig,
  useListSearchParams,
} from '../../components/data-display/useListSearchParams';
import { isCivilDate } from '../../lib/dates/dates';
import { isUuidV4 } from '../../lib/identifiers/uuid';

export const portfolioTabs = ['buildings', 'rooms'] as const;
export type PortfolioTab = (typeof portfolioTabs)[number];

const buildingVacancyFilters = new Set<BuildingVacancyFilter>(['WITH_VACANCY', 'FULL', 'NO_ROOMS']);
const roomStatuses = new Set<RoomAvailabilityStatus>(['VACANT', 'OCCUPIED']);

function nonEmpty(value: string | null, maxLength = 120): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function parsePortfolioTabValue(value: string | null): PortfolioTab {
  return value === 'rooms' ? 'rooms' : 'buildings';
}

export function parsePortfolioTab(searchParams: URLSearchParams): PortfolioTab {
  return parsePortfolioTabValue(searchParams.get('tab'));
}

export function usePortfolioTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parsePortfolioTab(searchParams);

  const setTab = useCallback(
    (nextTab: PortfolioTab) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set('tab', nextTab);
        return next;
      });
    },
    [setSearchParams],
  );

  return { tab, setTab };
}

export function createPortfolioBuildingSearchConfig(
  defaultDate: string,
): ListSearchConfig<BuildingListFilters> {
  return {
    filterKeys: ['q', 'date', 'vacancy'],
    clearFilterKeys: ['q', 'vacancy'],
    hasFiltersKeys: ['q', 'vacancy'],
    pageParam: 'buildingsPage',
    limitParam: 'buildingsLimit',
    paramNames: { q: 'buildingsQ', vacancy: 'buildingVacancy', date: 'date' },
    parse: (searchParams, page, limit) => {
      const vacancy = searchParams.get('vacancy');
      return {
        page,
        limit,
        q: nonEmpty(searchParams.get('q')),
        date: isCivilDate(searchParams.get('date')) ? searchParams.get('date')! : defaultDate,
        vacancy: buildingVacancyFilters.has(vacancy as BuildingVacancyFilter)
          ? (vacancy as BuildingVacancyFilter)
          : undefined,
      };
    },
  };
}

export function createPortfolioRoomSearchConfig(
  defaultDate: string,
): ListSearchConfig<RoomListFilters> {
  return {
    filterKeys: ['q', 'date', 'buildingId', 'status'],
    clearFilterKeys: ['q', 'buildingId', 'status'],
    hasFiltersKeys: ['q', 'buildingId', 'status'],
    pageParam: 'roomsPage',
    limitParam: 'roomsLimit',
    paramNames: {
      q: 'roomsQ',
      date: 'date',
      buildingId: 'roomBuildingId',
      status: 'roomStatus',
    },
    parse: (searchParams, page, limit) => {
      const status = searchParams.get('status');
      const buildingId = searchParams.get('buildingId');
      return {
        page,
        limit,
        q: nonEmpty(searchParams.get('q')),
        date: isCivilDate(searchParams.get('date')) ? searchParams.get('date')! : defaultDate,
        buildingId: buildingId && isUuidV4(buildingId) ? buildingId : undefined,
        status: roomStatuses.has(status as RoomAvailabilityStatus)
          ? (status as RoomAvailabilityStatus)
          : undefined,
      };
    },
  };
}

export function usePortfolioBuildingsSearchParams(defaultDate: string) {
  const config = useMemo(() => createPortfolioBuildingSearchConfig(defaultDate), [defaultDate]);
  return useListSearchParams(config);
}

export function usePortfolioRoomsSearchParams(defaultDate: string) {
  const config = useMemo(() => createPortfolioRoomSearchConfig(defaultDate), [defaultDate]);
  return useListSearchParams(config);
}
