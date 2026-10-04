const BEARER_PATTERN = /bearer\s+[a-z0-9._~+/-]+=*/gi;
const ASSIGNMENT_PATTERN =
  /(password|token|authorization|cookie)\s*[:=]\s*\S+/gi;

export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[_-]/g, '');
  if (normalized.includes('password')) {
    return true;
  }

  if (
    normalized === 'authorization' ||
    normalized === 'cookie' ||
    normalized === 'token'
  ) {
    return true;
  }

  return normalized.endsWith('token') || normalized.endsWith('secret');
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(BEARER_PATTERN, 'bearer [redacted]')
    .replace(ASSIGNMENT_PATTERN, '$1=[redacted]');
}

export function sanitizeLogValue(value: unknown, key?: string): unknown {
  if (key !== undefined && isSensitiveKey(key)) {
    return '[redacted]';
  }

  if (typeof value === 'string') {
    return redactSensitiveText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item));
  }

  if (value !== null && typeof value === 'object') {
    return sanitizeRecord(value as Record<string, unknown>);
  }

  return value;
}

function sanitizeRecord(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const path = typeof record['path'] === 'string' ? record['path'] : '';
  const loginRequest = path.toLowerCase().includes('login');
  const output: Record<string, unknown> = {};

  for (const [childKey, childValue] of Object.entries(record)) {
    if (loginRequest && childKey === 'body') {
      output[childKey] = '[redacted]';
      continue;
    }

    output[childKey] = sanitizeLogValue(childValue, childKey);
  }

  return output;
}
