import { DomainException } from '@ciadelivery/shared';
import { CurrentStore, StoreRecord } from '@ciadelivery/stores';
import { currentTenant } from '@ciadelivery/tenancy/domain';
import { RequestActor } from '@ciadelivery/users';
import { CustomerScope } from '../domain/customer';

export async function requireActorStore(
  actor: RequestActor,
  stores: CurrentStore,
): Promise<StoreRecord> {
  if (actor.tenantId === null || actor.storeId === null) {
    throw new DomainException('FORBIDDEN', 'The permission is required', 403);
  }

  const tenant = currentTenant();
  if (tenant === null || tenant.id !== actor.tenantId) {
    throw new DomainException(
      'TENANT_NOT_FOUND',
      'The tenant was not found',
      404,
    );
  }

  const store = await stores.findForCurrentTenant();
  if (
    store === null ||
    store.tenantId !== actor.tenantId ||
    store.id !== actor.storeId
  ) {
    throw new DomainException('STORE_NOT_FOUND', 'The store was not found', 404);
  }

  return store;
}

export async function requirePublicStore(
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

export function scopeOf(store: StoreRecord): CustomerScope {
  return { tenantId: store.tenantId, storeId: store.id };
}
