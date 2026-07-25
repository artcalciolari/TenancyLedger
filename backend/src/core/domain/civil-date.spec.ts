import { civilDateInTimeZone } from './civil-date';

describe('civilDateInTimeZone', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses empty components when Intl omits requested date parts', () => {
    jest.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts').mockReturnValue([]);

    expect(civilDateInTimeZone(new Date('2026-07-12T14:00:00.000Z'), 'UTC')).toBe('--');
  });
});
