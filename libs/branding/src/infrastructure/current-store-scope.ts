import { DomainException } from '@ciadelivery/shared';
import { currentTenant } from '@ciadelivery/tenancy/domain';
import { CurrentStore, StoreRecord } from '@ciadelivery/stores';

export async function requireCurrentStore(
  stores: CurrentStore,
): Promise<StoreRecord> {
  const tenant = currentTenant();
  if (tenant === null) {
    throw new DomainException(
      'TENANT_NOT_FOUND',
      'The tenant was not found',
      404,
    );
  }

  const store = await stores.findForCurrentTenant();
  if (store === null || store.tenantId !== tenant.id) {
    throw new DomainException('STORE_NOT_FOUND', 'The store was not found', 404);
  }

  return store;
}
