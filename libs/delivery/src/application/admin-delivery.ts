import {
  AddressInput,
  DomainException,
  GeocodingProvider,
  JsonLogger,
} from '@ciadelivery/shared';
import { CurrentStore, StoreRecord } from '@ciadelivery/stores';
import { currentTenant } from '@ciadelivery/tenancy/domain';
import { RequestActor } from '@ciadelivery/users';
import { DeliveryFeeZone } from '../domain/delivery-fee';
import {
  DeliveryConfigPatch,
  DeliveryConfigRecord,
  DeliveryPolicies,
  DeliveryPolicySnapshot,
  DeliveryZoneRecord,
} from '../domain/delivery-policy';

export interface DeliveryConfigView {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  maxRadiusKm: number;
  feeMode: DeliveryConfigRecord['feeMode'];
  flatFeeCents: number;
  estimatedMinutes: number;
  originLatitude: number | null;
  originLongitude: number | null;
}

export class AdminDelivery {
  private readonly logger = new JsonLogger();

  constructor(
    private readonly policies: DeliveryPolicies,
    private readonly stores: CurrentStore,
    private readonly geocoding: GeocodingProvider,
  ) {}

  async getConfig(actor: RequestActor): Promise<DeliveryConfigView> {
    return toView((await this.requirePolicy(actor)).config);
  }

  async updateConfig(
    actor: RequestActor,
    patch: DeliveryConfigPatch,
    zones: DeliveryFeeZone[] | null,
  ): Promise<DeliveryConfigView> {
    const store = await this.requireStore(actor);
    const snapshot = await this.policies.update({
      tenantId: store.tenantId,
      storeId: store.id,
      patch,
      zones,
      origin: await this.ensureOrigin(store),
    });
    this.logger.log(`Delivery config updated ${store.id}`);
    return toView(snapshot.config);
  }

  async listZones(actor: RequestActor): Promise<DeliveryZoneRecord[]> {
    return (await this.requirePolicy(actor)).zones;
  }

  async replaceZones(
    actor: RequestActor,
    zones: DeliveryFeeZone[],
  ): Promise<DeliveryZoneRecord[]> {
    const store = await this.requireStore(actor);
    const saved = await this.policies.replaceZones(store.tenantId, store.id, zones);
    this.logger.log(`Delivery zones replaced ${store.id}`);
    return saved;
  }

  async addZone(
    actor: RequestActor,
    zone: Omit<DeliveryFeeZone, 'sortOrder'>,
  ): Promise<DeliveryZoneRecord> {
    const store = await this.requireStore(actor);
    return this.policies.addZone(store.tenantId, store.id, zone);
  }

  async updateZone(
    actor: RequestActor,
    zoneId: string,
    patch: Partial<Omit<DeliveryFeeZone, 'sortOrder'>>,
  ): Promise<DeliveryZoneRecord> {
    const store = await this.requireStore(actor);
    return this.policies.updateZone(store.tenantId, store.id, zoneId, patch);
  }

  async deleteZone(actor: RequestActor, zoneId: string): Promise<void> {
    const store = await this.requireStore(actor);
    await this.policies.deleteZone(store.tenantId, store.id, zoneId);
  }

  private async ensureOrigin(
    store: StoreRecord,
  ): Promise<{ latitude: number; longitude: number }> {
    const current = originOf(store);
    if (current !== null) {
      return current;
    }

    const origin = await this.geocoding.geocode(storeAddress(store));
    await this.stores.saveCoordinates({
      tenantId: store.tenantId,
      storeId: store.id,
      latitude: origin.latitude,
      longitude: origin.longitude,
    });
    this.logger.log(`Store origin saved ${store.id}`);
    return origin;
  }

  private async requirePolicy(
    actor: RequestActor,
  ): Promise<DeliveryPolicySnapshot> {
    const store = await this.requireStore(actor);
    const policy = await this.policies.find(store.tenantId, store.id);
    if (policy === null) {
      throw new DomainException(
        'DELIVERY_CONFIG_NOT_FOUND',
        'The delivery configuration was not found',
        404,
      );
    }
    return policy;
  }

  private async requireStore(actor: RequestActor): Promise<StoreRecord> {
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

function storeAddress(store: StoreRecord): AddressInput {
  return {
    line: store.address.line,
    number: store.address.number,
    district: store.address.district,
    city: store.address.city,
    state: store.address.state,
    postalCode: store.address.postalCode,
    complement: null,
  };
}

function originOf(store: StoreRecord): { latitude: number; longitude: number } | null {
  if (store.latitude === null || store.longitude === null) {
    return null;
  }

  return { latitude: store.latitude, longitude: store.longitude };
}

function toView(config: DeliveryConfigRecord): DeliveryConfigView {
  return {
    deliveryEnabled: config.deliveryEnabled,
    pickupEnabled: config.pickupEnabled,
    maxRadiusKm: config.maxRadiusKm,
    feeMode: config.feeMode,
    flatFeeCents: config.flatFeeCents,
    estimatedMinutes: config.estimatedMinutes,
    originLatitude: config.originLatitude,
    originLongitude: config.originLongitude,
  };
}
