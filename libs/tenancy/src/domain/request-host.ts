export type RuntimeEnv = 'local' | 'development' | 'staging' | 'production';

export function readSingleHeader(
  value: string | string[] | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return Array.isArray(value) ? value[0] : value;
}

export function selectRequestHost(input: {
  nodeEnv: RuntimeEnv;
  hostHeader: string | undefined;
  tenantHostHeader: string | undefined;
}): string {
  const tenantHost =
    input.nodeEnv === 'local' || input.nodeEnv === 'development'
      ? blankToUndefined(input.tenantHostHeader)
      : undefined;

  if (tenantHost !== undefined) {
    return tenantHost;
  }

  return blankToUndefined(input.hostHeader) ?? '';
}

function blankToUndefined(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}
