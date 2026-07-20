import { ValidationError } from './errors/validation.error';

export interface CalendarPeriod {
  start: string;
  end: string;
}

/**
 * Adds whole calendar months while clamping the day to the last valid day in
 * the target month. All arithmetic is UTC-only so civil dates never cross a
 * boundary because of the process timezone.
 */
export function addCalendarMonths(dateISO: string, months: number): string {
  assertCivilDate(dateISO);
  if (!Number.isSafeInteger(months)) {
    throw new ValidationError('A quantidade de meses deve ser um número inteiro seguro.');
  }

  const year = Number(dateISO.slice(0, 4));
  const month = Number(dateISO.slice(5, 7));
  const day = Number(dateISO.slice(8, 10));
  const absoluteMonth = year * 12 + month - 1 + months;
  const targetYear = Math.floor(absoluteMonth / 12);
  const targetMonth = ((absoluteMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return formatUtcDate(new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay))));
}

/** Returns the inclusive one-calendar-month period beginning at `startISO`. */
export function calendarPeriodFrom(startISO: string): CalendarPeriod {
  assertCivilDate(startISO);
  return {
    start: startISO,
    end: addCivilDays(addCalendarMonths(startISO, 1), -1),
  };
}

export function addCivilDays(dateISO: string, days: number): string {
  assertCivilDate(dateISO);
  if (!Number.isSafeInteger(days)) {
    throw new ValidationError('A quantidade de dias deve ser um número inteiro seguro.');
  }
  const date = new Date(`${dateISO}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatUtcDate(date);
}

export function assertCivilDate(value: string, field = 'data'): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError(`A ${field} deve estar no formato AAAA-MM-DD.`);
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new ValidationError(`A ${field} é inválida.`);
  }
}

function formatUtcDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
