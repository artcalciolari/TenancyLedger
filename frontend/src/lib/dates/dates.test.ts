import { describe, expect, it } from 'vitest';
import { formatCivilDate, formatCompetence } from './dates';

describe('date utilities', () => {
  it('formata data civil sem converter fuso', () => {
    expect(formatCivilDate('2026-07-12')).toBe('12/07/2026');
  });

  it('formata competência', () => {
    expect(formatCompetence('2026-07')).toBe('07/2026');
  });
});
