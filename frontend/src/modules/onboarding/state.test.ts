import { describe, expect, it } from 'vitest';
import { coveredCalendarPeriod, todayIso } from './state';

describe('coveredCalendarPeriod', () => {
  it.each([
    ['2026-07-18', '2026-08-17'],
    ['2025-01-31', '2025-02-27'],
    ['2024-01-31', '2024-02-28'],
    ['2026-12-30', '2027-01-29'],
  ])('calcula o período inclusivo iniciado em %s', (start, end) => {
    expect(coveredCalendarPeriod(start)).toEqual({ start, end });
  });

  it('recusa datas civis inexistentes', () => {
    expect(coveredCalendarPeriod('2026-02-30')).toBeNull();
    expect(coveredCalendarPeriod('18/07/2026')).toBeNull();
  });
});

describe('todayIso', () => {
  it('usa componentes locais sem converter a data para UTC', () => {
    expect(todayIso(new Date(2026, 6, 18, 23, 30))).toBe('2026-07-18');
  });
});
