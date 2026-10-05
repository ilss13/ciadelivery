import {
  actorTypeOf,
  AuditLogs,
  recordAudit,
  recordChanged,
} from '@ciadelivery/audit';
import {
  AddressInput,
  DomainException,
  GeocodingProvider,
  JsonLogger,
} from '@ciadelivery/shared';
import { CurrentStore, StoreRecord } from '@ciadelivery/stores';
import {
  currentTenant,
  TransactionContext,
  UnitOfWork,
} from '@ciadelivery/tenancy/domain';
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
    private readonly unitOfWork: UnitOfWork,
    private readonly audit: AuditLogs,
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
    const origin = await this.ensureOrigin(store);
    const previous = await this.policies.find(store.tenantId, store.id);
    const snapshot = await this.unitOfWork.run(async (tx) => {
      const updated = await this.policies.update({
        tenantId: store.tenantId,
        storeId: store.id,
        patch,
        zones,
        origin,
        tx,
      });
      if (previous !== null) {
        await recordChanged(this.audit, tx, {
          tenantId: store.tenantId,
          actor,
          action: 'delivery.updated',
          entityType: 'delivery_config',
          entityId: previous.config.id,
          before: configAudit(previous.config),
          after: configAudit(updated.config),
        });
        if (zones !== null) {
          await recordChanged(this.audit, tx, {
            tenantId: store.tenantId,
            actor,
            action: 'delivery.zones_updated',
            entityType: 'delivery_config',
            entityId: previous.config.id,
            before: { zones: zonesAudit(previous.zones) },
            after: { zones: zonesAudit(updated.zones) },
          });
        }
      }
      return updated;
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
    const previous = await this.policies.find(store.tenantId, store.id);
    const saved = await this.unitOfWork.run(async (tx) => {
      const next = await this.policies.replaceZones(
        store.tenantId,
        store.id,
        zones,
        tx,
      );
      if (previous !== null) {
        await recordChanged(this.audit, tx, {
          tenantId: store.tenantId,
          actor,
          action: 'delivery.zones_updated',
          entityType: 'delivery_config',
          entityId: previous.config.id,
          before: { zones: zonesAudit(previous.zones) },
          after: { zones: zonesAudit(next) },
        });
      }
      return next;
    });
    this.logger.log(`Delivery zones replaced ${store.id}`);
    return saved;
  }

  async addZone(
    actor: RequestActor,
    zone: Omit<DeliveryFeeZone, 'sortOrder'>,
  ): Promise<DeliveryZoneRecord> {
    const store = await this.requireStore(actor);
    return this.unitOfWork.run(async (tx) => {
      const created = await this.policies.addZone(
        store.tenantId,
        store.id,
        zone,
        tx,
      );
      await recordAudit(this.audit, tx, {
        tenantId: store.tenantId,
        actorId: actor.userId,
        actorType: actorTypeOf(actor.role),
        action: 'delivery.zone_added',
        entityType: 'delivery_zone',
        entityId: created.id,
        before: null,
        changes: zoneAudit(created),
      });
      return created;
    });
  }

  async updateZone(
    actor: RequestActor,
    zoneId: string,
    patch: Partial<Omit<DeliveryFeeZone, 'sortOrder'>>,
  ): Promise<DeliveryZoneRecord> {
    const store = await this.requireStore(actor);
    const previous = await this.policies.find(store.tenantId, store.id);
    const current = previous?.zones.find((item) => item.id === zoneId) ?? null;
    return this.unitOfWork.run(async (tx) => {
      const saved = await this.policies.updateZone(
        store.tenantId,
        store.id,
        zoneId,
        patch,
        tx,
      );
      if (current !== null) {
        await recordChanged(this.audit, tx, {
          tenantId: store.tenantId,
          actor,
          action: 'delivery.zone_updated',
          entityType: 'delivery_zone',
          entityId: saved.id,
          before: zoneAudit(current),
          after: zoneAudit(saved),
        });
      }
      return saved;
    });
  }

  async deleteZone(actor: RequestActor, zoneId: string): Promise<void> {
    const store = await this.requireStore(actor);
    const previous = await this.policies.find(store.tenantId, store.id);
    const current = previous?.zones.find((item) => item.id === zoneId) ?? null;
    await this.unitOfWork.run(async (tx) => {
      await this.policies.deleteZone(store.tenantId, store.id, zoneId, tx);
      if (current !== null) {
        await this.noteZoneDeleted(actor, store, current, tx);
      }
    });
  }

  private async noteZoneDeleted(
    actor: RequestActor,
    store: StoreRecord,
    zone: DeliveryZoneRecord,
    tx: TransactionContext,
  ): Promise<void> {
    await recordAudit(this.audit, tx, {
      tenantId: store.tenantId,
      actorId: actor.userId,
      actorType: actorTypeOf(actor.role),
      action: 'delivery.zone_deleted',
      entityType: 'delivery_zone',
      entityId: zone.id,
      before: zoneAudit(zone),
      changes: { deleted: true },
    });
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

function configAudit(config: DeliveryConfigRecord): Record<string, unknown> {
  return {
    deliveryEnabled: config.deliveryEnabled,
    pickupEnabled: config.pickupEnabled,
    maxRadiusKm: config.maxRadiusKm,
    feeMode: config.feeMode,
    flatFeeCents: config.flatFeeCents,
    estimatedMinutes: config.estimatedMinutes,
  };
}

function zoneAudit(
  zone: Pick<DeliveryZoneRecord, 'fromKm' | 'toKm' | 'feeCents'>,
): Record<string, unknown> {
  return {
    fromKm: zone.fromKm,
    toKm: zone.toKm,
    feeCents: zone.feeCents,
  };
}

function zonesAudit(zones: readonly DeliveryZoneRecord[]): Record<string, unknown>[] {
  return zones.map(zoneAudit);
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
