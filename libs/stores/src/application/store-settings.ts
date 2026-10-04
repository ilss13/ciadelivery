import { DomainException } from '@ciadelivery/shared';
import { currentTenant } from '@ciadelivery/tenancy/domain';
import { RequestActor } from '@ciadelivery/users';
import {
  CurrentStore,
  StoreProfileUpdate,
  StoreRecord,
  StoreSettings,
  toStoreSettings,
} from '../domain/current-store';

export class GetStoreSettings {
  constructor(private readonly stores: CurrentStore) {}

  async execute(actor: RequestActor): Promise<StoreSettings> {
    return toStoreSettings(await this.requireStore(actor));
  }

  private async requireStore(actor: RequestActor): Promise<StoreRecord> {
    assertStoreActor(actor);
    const store = await this.stores.findForCurrentTenant();
    if (
      store === null ||
      store.tenantId !== actor.tenantId ||
      store.id !== actor.storeId
    ) {
      throw new DomainException(
        'STORE_NOT_FOUND',
        'The store was not found',
        404,
      );
    }

    return store;
  }
}

export class UpdateStoreSettings {
  constructor(private readonly stores: CurrentStore) {}

  async execute(
    actor: RequestActor,
    patch: StoreProfileUpdate,
  ): Promise<StoreSettings> {
    assertStoreActor(actor);
    const updated = await this.stores.updateForCurrentTenant(patch);
    if (updated.tenantId !== actor.tenantId || updated.id !== actor.storeId) {
      throw new DomainException(
        'STORE_NOT_FOUND',
        'The store was not found',
        404,
      );
    }

    return toStoreSettings(updated);
  }
}

function assertStoreActor(actor: RequestActor): void {
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
}
