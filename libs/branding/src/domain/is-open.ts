export interface OpenWindow {
  weekday: number;
  opensAt: string;
  closesAt: string;
  closed: boolean;
}

export function isStoreOpen(input: {
  now: Date;
  timeZone: string;
  manuallyClosed: boolean;
  hours: readonly OpenWindow[];
}): boolean {
  if (input.manuallyClosed) {
    return false;
  }

  const clock = zonedClock(input.now, input.timeZone);
  const today = input.hours.find((day) => day.weekday === clock.weekday);
  const yesterday = input.hours.find(
    (day) => day.weekday === (clock.weekday + 6) % 7,
  );
  return (
    isInsideSameDay(today, clock.seconds) ||
    isInsideOvernightTail(yesterday, clock.seconds)
  );
}

export function zonedClock(
  now: Date,
  timeZone: string,
): { weekday: number; seconds: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  const weekday = WEEKDAYS[read('weekday')];
  if (weekday === undefined) {
    throw new Error(`Invalid STORE_TIMEZONE: ${timeZone}`);
  }

  let hour = Number(read('hour'));
  if (hour === 24) {
    hour = 0;
  }

  return {
    weekday,
    seconds: hour * 3600 + Number(read('minute')) * 60 + Number(read('second')),
  };
}

const WEEKDAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function isInsideSameDay(
  slot: OpenWindow | undefined,
  seconds: number,
): boolean {
  if (slot === undefined || slot.closed) {
    return false;
  }

  const opens = toSeconds(slot.opensAt);
  const closes = toSeconds(slot.closesAt);
  if (opens === closes) {
    return false;
  }
  if (opens < closes) {
    return seconds >= opens && seconds < closes;
  }

  return seconds >= opens;
}

function isInsideOvernightTail(
  slot: OpenWindow | undefined,
  seconds: number,
): boolean {
  if (slot === undefined || slot.closed) {
    return false;
  }

  const opens = toSeconds(slot.opensAt);
  const closes = toSeconds(slot.closesAt);
  if (opens <= closes) {
    return false;
  }

  return seconds < closes;
}

function toSeconds(value: string): number {
  const [hours, minutes, seconds] = value.split(':').map(Number);
  return (hours ?? 0) * 3600 + (minutes ?? 0) * 60 + (seconds ?? 0);
}
