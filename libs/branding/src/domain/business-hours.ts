import { DomainException } from '@ciadelivery/shared';

const TIME = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

export interface BusinessDay {
  weekday: number;
  opensAt: string;
  closesAt: string;
  closed: boolean;
}

export function normalizeTime(value: string): string {
  const match = TIME.exec(value.trim());
  const hours = match?.[1];
  const minutes = match?.[2];
  if (hours === undefined || minutes === undefined) {
    throw invalidHours();
  }

  return `${hours}:${minutes}:${match?.[3] ?? '00'}`;
}

export function assertBusinessHours(
  days: readonly BusinessDay[],
): BusinessDay[] {
  if (days.length !== 7) {
    throw invalidHours();
  }

  const seen = new Set<number>();
  const normalized = days.map((day) => {
    if (!Number.isInteger(day.weekday) || day.weekday < 0 || day.weekday > 6) {
      throw invalidHours();
    }
    if (seen.has(day.weekday)) {
      throw invalidHours();
    }
    seen.add(day.weekday);

    const opensAt = normalizeTime(day.opensAt);
    const closesAt = normalizeTime(day.closesAt);
    if (!day.closed && opensAt === closesAt) {
      throw invalidHours();
    }

    return {
      weekday: day.weekday,
      opensAt,
      closesAt,
      closed: day.closed,
    };
  });

  return normalized.sort((left, right) => left.weekday - right.weekday);
}

export function completeWeek(days: readonly BusinessDay[]): BusinessDay[] {
  const byWeekday = new Map(days.map((day) => [day.weekday, day]));
  return [0, 1, 2, 3, 4, 5, 6].map(
    (weekday) =>
      byWeekday.get(weekday) ?? {
        weekday,
        opensAt: '00:00:00',
        closesAt: '00:00:00',
        closed: true,
      },
  );
}

export function demoWeek(): BusinessDay[] {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
    if (weekday === 1) {
      return {
        weekday,
        opensAt: '00:00:00',
        closesAt: '00:00:00',
        closed: true,
      };
    }

    return {
      weekday,
      opensAt: '18:00:00',
      closesAt: '23:00:00',
      closed: false,
    };
  });
}

function invalidHours(): DomainException {
  return new DomainException(
    'INVALID_BUSINESS_HOURS',
    'The business hours are invalid',
    400,
  );
}
