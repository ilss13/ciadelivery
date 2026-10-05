import { DomainException } from '@ciadelivery/shared';

const MAX_INCLUSIVE_DAYS = 366;

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export interface StorePeriod {
  start: Date;
  end: Date;
}

export function resolveStorePeriod(
  from: string,
  to: string,
  timeZone: string,
): StorePeriod {
  const startDate = parseCalendarDate(from);
  const endDate = parseCalendarDate(to);
  if (startDate === null || endDate === null) {
    throw invalidPeriod();
  }

  const span = dayNumber(endDate) - dayNumber(startDate) + 1;
  if (span < 1 || span > MAX_INCLUSIVE_DAYS) {
    throw invalidPeriod();
  }

  try {
    return {
      start: zonedMidnight(startDate, timeZone),
      end: zonedMidnight(addDays(endDate, 1), timeZone),
    };
  } catch {
    throw invalidPeriod();
  }
}

export function todayInTimeZone(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function parseCalendarDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function invalidPeriod(): DomainException {
  return new DomainException(
    'REPORT_PERIOD_INVALID',
    'The report period is invalid',
    400,
  );
}

function dayNumber(date: CalendarDate): number {
  return Math.floor(Date.UTC(date.year, date.month - 1, date.day) / 86_400_000);
}

function addDays(date: CalendarDate, days: number): CalendarDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

function zonedMidnight(date: CalendarDate, timeZone: string): Date {
  const guess = new Date(
    `${pad(date.year, 4)}-${pad(date.month, 2)}-${pad(date.day, 2)}T00:00:00.000Z`,
  );
  const corrected = new Date(guess.getTime() - zoneOffsetMs(guess, timeZone));
  return new Date(guess.getTime() - zoneOffsetMs(corrected, timeZone));
}

function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  let hour = Number(read('hour'));
  if (hour === 24) {
    hour = 0;
  }
  const asUtc = Date.UTC(
    Number(read('year')),
    Number(read('month')) - 1,
    Number(read('day')),
    hour,
    Number(read('minute')),
    Number(read('second')),
  );
  return asUtc - instant.getTime();
}

function pad(value: number, length: number): string {
  return value.toString().padStart(length, '0');
}
