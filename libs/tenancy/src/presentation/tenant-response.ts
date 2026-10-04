import { ProvisionedStore } from '../domain/stores.port';
import { Tenant } from '../domain/tenant';
import { TenantWithStore } from '../application/create-tenant';
import { TenantPage } from '../application/list-tenants';

export interface TenantBody {
  id: string;
  name: string;
  slug: string;
  status: string;
  planCode: string;
  customDomain: string | null;
  createdAt: string;
  updatedAt: string;
  store: StoreBody;
}

export interface StoreBody {
  id: string;
  name: string;
  phone: string;
  address: ProvisionedStore['address'];
  latitude: number | null;
  longitude: number | null;
  minimumOrderCents: number;
  isManuallyClosed: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toTenantBody(value: TenantWithStore): TenantBody {
  return {
    ...tenantFields(value.tenant),
    store: toStoreBody(value.store),
  };
}

export function toTenantPageBody(page: TenantPage): {
  data: TenantBody[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
} {
  return {
    data: page.items.map(toTenantBody),
    meta: {
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: page.totalPages,
    },
  };
}

function tenantFields(tenant: Tenant): Omit<TenantBody, 'store'> {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    planCode: tenant.planCode,
    customDomain: tenant.customDomain,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString(),
  };
}

function toStoreBody(store: ProvisionedStore): StoreBody {
  return {
    id: store.id,
    name: store.name,
    phone: store.phone,
    address: store.address,
    latitude: store.latitude,
    longitude: store.longitude,
    minimumOrderCents: store.minimumOrderCents,
    isManuallyClosed: store.isManuallyClosed,
    createdAt: store.createdAt.toISOString(),
    updatedAt: store.updatedAt.toISOString(),
  };
}
