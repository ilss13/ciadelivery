import {
  AddressInput,
  DomainException,
  GeocodingProvider,
} from '@ciadelivery/shared';
import { currentTenant } from '@ciadelivery/tenancy/domain';
import { RequestActor } from '@ciadelivery/users';
import {
  CurrentStore,
  StoreAddress,
  StoreCoordinates,
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
  constructor(
    private readonly stores: CurrentStore,
    private readonly geocoding: GeocodingProvider,
  ) {}

  async execute(
    actor: RequestActor,
    patch: StoreProfileUpdate,
  ): Promise<StoreSettings> {
    assertStoreActor(actor);
    const current = await this.stores.findForCurrentTenant();
    if (
      current === null ||
      current.tenantId !== actor.tenantId ||
      current.id !== actor.storeId
    ) {
      throw new DomainException(
        'STORE_NOT_FOUND',
        'The store was not found',
        404,
      );
    }

    const coordinates = await this.coordinatesFor(current, patch.address);
    const updated = await this.stores.updateForCurrentTenant(patch, coordinates);
    if (updated.tenantId !== actor.tenantId || updated.id !== actor.storeId) {
      throw new DomainException(
        'STORE_NOT_FOUND',
        'The store was not found',
        404,
      );
    }

    return toStoreSettings(updated);
  }

  private async coordinatesFor(
    current: StoreRecord,
    address: StoreAddress,
  ): Promise<StoreCoordinates> {
    if (
      current.latitude !== null &&
      current.longitude !== null &&
      sameAddress(current.address, address)
    ) {
      return { latitude: current.latitude, longitude: current.longitude };
    }

    return this.geocoding.geocode(toAddressInput(address));
  }
}

function toAddressInput(address: StoreAddress): AddressInput {
  return {
    line: address.line,
    number: address.number,
    district: address.district,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    complement: null,
  };
}

function sameAddress(current: StoreAddress, next: StoreAddress): boolean {
  return (
    current.line === next.line &&
    current.number === next.number &&
    current.district === next.district &&
    current.city === next.city &&
    current.state === next.state &&
    current.postalCode === next.postalCode
  );
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
