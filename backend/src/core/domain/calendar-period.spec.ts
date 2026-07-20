import { ValidationError } from './errors/validation.error';
import { addCalendarMonths, addCivilDays, calendarPeriodFrom } from './calendar-period';

describe('calendar periods', () => {
  it.each([
    ['2025-01-29', '2025-02-28'],
    ['2025-01-30', '2025-02-28'],
    ['2025-01-31', '2025-02-28'],
    ['2024-01-31', '2024-02-29'],
    ['2025-12-31', '2026-01-31'],
  ])('adds one calendar month to %s', (start, expected) => {
    expect(addCalendarMonths(start, 1)).toBe(expected);
  });

  it.each([
    ['2026-07-18', { start: '2026-07-18', end: '2026-08-17' }],
    ['2025-01-31', { start: '2025-01-31', end: '2025-02-27' }],
    ['2024-01-31', { start: '2024-01-31', end: '2024-02-28' }],
    ['2025-12-31', { start: '2025-12-31', end: '2026-01-30' }],
  ])('builds an inclusive calendar period from %s', (start, expected) => {
    expect(calendarPeriodFrom(start)).toEqual(expected);
  });

  it('supports negative month and day arithmetic', () => {
    expect(addCalendarMonths('2026-01-31', -1)).toBe('2025-12-31');
    expect(addCivilDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it.each([
    () => addCalendarMonths('2026-02-30', 1),
    () => addCalendarMonths('2026-01-01', 1.5),
    () => addCivilDays('01/01/2026', 1),
    () => addCivilDays('2026-01-01', Number.MAX_VALUE),
  ])('rejects invalid calendar arithmetic', (operation) => {
    expect(operation).toThrow(ValidationError);
  });
});
