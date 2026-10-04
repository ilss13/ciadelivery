import { DomainException } from '@ciadelivery/shared';
import { parseTenantHost } from '../domain/parse-tenant-host';
import { Tenant } from '../domain/tenant';
import { TenantRepository } from '../domain/tenant-repository';

export type TenantResolution =
  | { kind: 'platform' }
  | { kind: 'tenant'; tenant: Tenant };

export class ResolveTenant {
  constructor(private readonly tenants: TenantRepository) {}

  async execute(
    rawHost: string,
    platformDomain: string,
  ): Promise<TenantResolution> {
    const parsed = parseTenantHost(rawHost, platformDomain);
    if (parsed.kind === 'platform') {
      return { kind: 'platform' };
    }

    if (parsed.kind === 'reserved') {
      throw tenantNotFound();
    }

    const tenant =
      parsed.kind === 'slug'
        ? await this.tenants.findBySlug(parsed.slug)
        : await this.tenants.findByCustomDomain(parsed.host);

    if (tenant === null) {
      throw tenantNotFound();
    }

    if (tenant.status === 'SUSPENDED') {
      throw new DomainException(
        'TENANT_SUSPENDED',
        'The tenant is suspended',
        403,
      );
    }

    return { kind: 'tenant', tenant };
  }
}

function tenantNotFound(): DomainException {
  return new DomainException(
    'TENANT_NOT_FOUND',
    'The tenant was not found',
    404,
  );
}
