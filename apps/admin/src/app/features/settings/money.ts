export function centsToReais(cents: number): string {
  const reais = Math.trunc(cents / 100);
  const fraction = Math.abs(cents % 100)
    .toString()
    .padStart(2, '0');
  return `${reais},${fraction}`;
}

export function reaisToCents(value: string): number | null {
  const match = /^(\d+)(?:,(\d{1,2}))?$/.exec(value.trim());
  if (match === null) {
    return null;
  }

  const reais = Number(match[1]);
  const fraction = (match[2] ?? '').padEnd(2, '0');
  const cents = reais * 100 + Number(fraction);
  if (!Number.isSafeInteger(cents) || cents > 4294967295) {
    return null;
  }

  return cents;
}
