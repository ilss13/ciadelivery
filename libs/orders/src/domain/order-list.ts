import { DomainException } from '@ciadelivery/shared';

export function orderListBounds(
  from: string | undefined,
  to: string | undefined,
): { from: Date | null; to: Date | null } {
  const start = parseInstant(from);
  const end = parseInstant(to);
  if (
    start !== null &&
    end !== null &&
    start.getTime() > end.getTime()
  ) {
    throw new DomainException(
      'VALIDATION_ERROR',
      'The date range is invalid',
      400,
    );
  }
  return { from: start, to: end };
}

function parseInstant(value: string | undefined): Date | null {
  if (value === undefined || value.trim().length === 0) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new DomainException(
      'VALIDATION_ERROR',
      'The date range is invalid',
      400,
    );
  }
  return parsed;
}
