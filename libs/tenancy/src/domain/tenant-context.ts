import { AsyncLocalStorage } from 'node:async_hooks';
import { Tenant } from './tenant';

const tenantStorage = new AsyncLocalStorage<Tenant>();

export function runWithTenant<T>(tenant: Tenant, fn: () => T): T {
  return tenantStorage.run(tenant, fn);
}

export function enterTenantContext(tenant: Tenant): void {
  tenantStorage.enterWith(tenant);
}

export function currentTenant(): Tenant | null {
  return tenantStorage.getStore() ?? null;
}
