import { DomainException } from '@ciadelivery/shared';

const COLOR = /^#[0-9A-F]{6}$/;

export function normalizeColor(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!COLOR.test(normalized)) {
    throw new DomainException('INVALID_COLOR', 'The color is invalid', 400);
  }

  return normalized;
}
