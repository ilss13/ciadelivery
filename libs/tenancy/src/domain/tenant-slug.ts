export const RESERVED_TENANT_SLUGS = [
  'www',
  'painel',
  'api',
  'admin',
  'app',
  'mail',
  'cdn',
] as const;

const TENANT_SLUG_PATTERN = /^[a-z0-9-]+$/;

export function isReservedTenantSlug(slug: string): boolean {
  return (RESERVED_TENANT_SLUGS as readonly string[]).includes(slug);
}

export function isValidTenantSlug(slug: string): boolean {
  return (
    slug.length >= 1 && slug.length <= 63 && TENANT_SLUG_PATTERN.test(slug)
  );
}
