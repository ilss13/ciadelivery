import { DomainException } from '@ciadelivery/shared';
import { Stores } from '../domain/stores.port';
import { TenantRepository } from '../domain/tenant-repository';
import { TenantWithStore } from './create-tenant';

export class GetTenant {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly stores: Stores,
  ) {}

  async execute(id: string): Promise<TenantWithStore> {
    const tenant = await this.tenants.findById(id);
    if (tenant === null) {
      throw new DomainException(
        'TENANT_NOT_FOUND',
        'The tenant was not found',
        404,
      );
    }

    const store = await this.stores.findByTenantId(tenant.id);
    if (store === null) {
      throw new DomainException(
        'STORE_NOT_FOUND',
        'The store was not found',
        404,
      );
    }

    return { tenant, store };
  }
}
