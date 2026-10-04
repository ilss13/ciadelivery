import { isReservedTenantSlug, isValidTenantSlug } from './tenant-slug';

export type ParsedTenantHost =
  | { kind: 'platform' }
  | { kind: 'slug'; slug: string }
  | { kind: 'reserved'; slug: string }
  | { kind: 'custom-domain'; host: string };

export function stripHostPort(host: string): string {
  const trimmed = host.trim().toLowerCase();
  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']');
    return end === -1 ? trimmed : trimmed.slice(0, end + 1);
  }

  const colon = trimmed.lastIndexOf(':');
  if (colon === -1) {
    return trimmed;
  }

  const port = trimmed.slice(colon + 1);
  if (/^\d+$/.test(port)) {
    return trimmed.slice(0, colon);
  }

  return trimmed;
}

export function parseTenantHost(
  rawHost: string,
  platformDomain: string,
): ParsedTenantHost {
  const host = stripHostPort(rawHost);
  const domain = platformDomain.trim().toLowerCase();

  if (
    domain.length > 0 &&
    (host === domain || host === `www.${domain}` || host === `painel.${domain}`)
  ) {
    return { kind: 'platform' };
  }

  const suffix = `.${domain}`;
  if (domain.length > 0 && host.endsWith(suffix)) {
    const label = host.slice(0, -suffix.length);
    if (isValidTenantSlug(label)) {
      if (isReservedTenantSlug(label)) {
        return { kind: 'reserved', slug: label };
      }

      return { kind: 'slug', slug: label };
    }
  }

  return { kind: 'custom-domain', host };
}
