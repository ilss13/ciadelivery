import { resolveStorePeriod, todayInTimeZone } from './report-period';

describe('resolveStorePeriod', () => {
  it('converts inclusive store dates to a UTC half-open window', () => {
    const period = resolveStorePeriod(
      '2026-10-05',
      '2026-10-05',
      'America/Sao_Paulo',
    );

    expect(period.start.toISOString()).toBe('2026-10-05T03:00:00.000Z');
    expect(period.end.toISOString()).toBe('2026-10-06T03:00:00.000Z');
  });

  it('accepts 366 inclusive days and refuses 367', () => {
    expect(() =>
      resolveStorePeriod('2024-01-01', '2024-12-31', 'America/Sao_Paulo'),
    ).not.toThrow();
    expect(() =>
      resolveStorePeriod('2024-01-01', '2025-01-01', 'America/Sao_Paulo'),
    ).toThrow(
      expect.objectContaining({ code: 'REPORT_PERIOD_INVALID', statusCode: 400 }),
    );
  });

  it('reads the calendar day in the store timezone', () => {
    expect(
      todayInTimeZone(new Date('2026-10-05T02:30:00.000Z'), 'America/Sao_Paulo'),
    ).toBe('2026-10-04');
    expect(
      todayInTimeZone(new Date('2026-10-05T03:30:00.000Z'), 'America/Sao_Paulo'),
    ).toBe('2026-10-05');
  });

  it('refuses an inverted or impossible date', () => {
    expect(() =>
      resolveStorePeriod('2026-10-06', '2026-10-05', 'UTC'),
    ).toThrow(expect.objectContaining({ code: 'REPORT_PERIOD_INVALID' }));
    expect(() =>
      resolveStorePeriod('2026-02-31', '2026-03-01', 'UTC'),
    ).toThrow(expect.objectContaining({ code: 'REPORT_PERIOD_INVALID' }));
  });
});
