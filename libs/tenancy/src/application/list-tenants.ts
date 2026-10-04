import { DomainException } from '@ciadelivery/shared';
import { ProvisionedStore, Stores } from '../domain/stores.port';
import { Tenant } from '../domain/tenant';
import { TenantRepository } from '../domain/tenant-repository';
import { TenantWithStore } from './create-tenant';

export interface TenantPage {
  items: TenantWithStore[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export class ListTenants {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly stores: Stores,
  ) {}

  async execute(page: number, pageSize: number): Promise<TenantPage> {
    const listed = await this.tenants.list(page, pageSize);
    const stores = await this.stores.findByTenantIds(
      listed.items.map((tenant) => tenant.id),
    );
    const byTenant = new Map<string, ProvisionedStore>(
      stores.map((store) => [store.tenantId, store]),
    );

    return {
      items: listed.items.map((tenant) => ({
        tenant,
        store: storeFor(tenant, byTenant),
      })),
      page,
      pageSize,
      total: listed.total,
      totalPages: listed.total === 0 ? 0 : Math.ceil(listed.total / pageSize),
    };
  }
}

function storeFor(
  tenant: Tenant,
  byTenant: Map<string, ProvisionedStore>,
): ProvisionedStore {
  const store = byTenant.get(tenant.id);
  if (store === undefined) {
    throw new DomainException(
      'STORE_NOT_FOUND',
      'The store was not found',
      404,
    );
  }

  return store;
}
