import { BusinessDay } from './business-hours';
import { isStoreOpen } from './is-open';

const SAO_PAULO = 'America/Sao_Paulo';

function week(
  patch: (weekday: number) => Partial<BusinessDay>,
): BusinessDay[] {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    opensAt: '00:00:00',
    closesAt: '00:00:00',
    closed: true,
    ...patch(weekday),
  }));
}

describe('isStoreOpen', () => {
  const mondayWindow = week((weekday) =>
    weekday === 1
      ? { opensAt: '18:00:00', closesAt: '23:00:00', closed: false }
      : {},
  );

  it('is open inside the same-day window', () => {
    expect(
      isStoreOpen({
        now: new Date('2026-10-05T22:00:00.000Z'),
        timeZone: SAO_PAULO,
        manuallyClosed: false,
        hours: mondayWindow,
      }),
    ).toBe(true);
  });

  it('is closed outside the window', () => {
    expect(
      isStoreOpen({
        now: new Date('2026-10-05T20:30:00.000Z'),
        timeZone: SAO_PAULO,
        manuallyClosed: false,
        hours: mondayWindow,
      }),
    ).toBe(false);
  });

  it('stays open after midnight when the shift crosses midnight', () => {
    const overnight = week((weekday) =>
      weekday === 0
        ? { opensAt: '22:00:00', closesAt: '02:00:00', closed: false }
        : {},
    );

    expect(
      isStoreOpen({
        now: new Date('2026-10-05T01:30:00.000Z'),
        timeZone: SAO_PAULO,
        manuallyClosed: false,
        hours: overnight,
      }),
    ).toBe(true);
    expect(
      isStoreOpen({
        now: new Date('2026-10-05T04:00:00.000Z'),
        timeZone: SAO_PAULO,
        manuallyClosed: false,
        hours: overnight,
      }),
    ).toBe(true);
    expect(
      isStoreOpen({
        now: new Date('2026-10-05T06:00:00.000Z'),
        timeZone: SAO_PAULO,
        manuallyClosed: false,
        hours: overnight,
      }),
    ).toBe(false);
  });

  it('is closed when the store was closed manually', () => {
    expect(
      isStoreOpen({
        now: new Date('2026-10-05T22:00:00.000Z'),
        timeZone: SAO_PAULO,
        manuallyClosed: true,
        hours: mondayWindow,
      }),
    ).toBe(false);
  });

  it('uses the store timezone', () => {
    const instant = new Date('2026-10-05T20:30:00.000Z');
    expect(
      isStoreOpen({
        now: instant,
        timeZone: SAO_PAULO,
        manuallyClosed: false,
        hours: mondayWindow,
      }),
    ).toBe(false);
    expect(
      isStoreOpen({
        now: instant,
        timeZone: 'UTC',
        manuallyClosed: false,
        hours: mondayWindow,
      }),
    ).toBe(true);
  });
});
