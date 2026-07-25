import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatCivilDate,
  formatCompetence,
  formatDateTime,
  isCivilDate,
  localDateIso,
} from './dates';

describe('date utilities', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formata data civil sem converter fuso', () => {
    expect(formatCivilDate('2026-07-12')).toBe('12/07/2026');
    expect(formatCivilDate('data inválida')).toBe('data inválida');
  });

  it('formata competência', () => {
    expect(formatCompetence('2026-07')).toBe('07/2026');
    expect(formatCompetence('2026/07')).toBe('2026/07');
  });

  it('obtém a data local de São Paulo', () => {
    expect(localDateIso(new Date('2026-07-12T15:00:00.000Z'))).toBe('2026-07-12');
    expect(localDateIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('tolera partes ausentes retornadas pelo formatador', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      class {
        formatToParts = () => [{ type: 'year', value: '2026' }];
      } as typeof Intl.DateTimeFormat,
    );

    expect(localDateIso(new Date())).toBe('2026--');
  });

  it('valida datas civis reais', () => {
    expect(isCivilDate('2024-02-29')).toBe(true);
    expect(isCivilDate(null)).toBe(false);
    expect(isCivilDate('2026/07/12')).toBe(false);
    expect(isCivilDate('2026-02-30')).toBe(false);
    expect(isCivilDate('2026-01-32')).toBe(false);
  });

  it('formata data e hora com fallback para valores ausentes ou inválidos', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('inválida')).toBe('inválida');
    expect(formatDateTime('2026-07-12T15:00:00.000Z')).toMatch(/12\/07\/2026/);
  });
});
