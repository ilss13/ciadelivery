import { randomUUID } from 'node:crypto';
import { DatabaseReady, DomainException } from '@ciadelivery/shared';
import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { assertDeliveryZones, DeliveryFeeZone } from '../domain/delivery-fee';
import {
  DeliveryConfigPatch,
  DeliveryConfigRecord,
  DeliveryOrigin,
  DeliveryPolicies,
  DeliveryPolicySnapshot,
  DeliveryZoneRecord,
} from '../domain/delivery-policy';
import {
  DeliveryConfigEntity,
  DeliveryZoneEntity,
} from './delivery.entities';

@Injectable()
export class TypeOrmDeliveryPolicies implements DeliveryPolicies {
  constructor(private readonly database: DatabaseReady) {}

  async find(
    tenantId: string,
    storeId: string,
  ): Promise<DeliveryPolicySnapshot | null> {
    const dataSource = await this.database.ensure();
    return this.load(dataSource.manager, tenantId, storeId);
  }

  async update(input: {
    tenantId: string;
    storeId: string;
    patch: DeliveryConfigPatch;
    zones: DeliveryFeeZone[] | null;
    origin: DeliveryOrigin | null;
    tx?: TransactionContext;
  }): Promise<DeliveryPolicySnapshot> {
    return this.transact(input.tx, async (manager) => {
      const config = await this.lockConfig(
        manager,
        input.tenantId,
        input.storeId,
      );
      config.deliveryEnabled = input.patch.deliveryEnabled;
      config.pickupEnabled = input.patch.pickupEnabled;
      config.maxRadiusKm = input.patch.maxRadiusKm;
      config.feeMode = input.patch.feeMode;
      config.flatFeeCents = input.patch.flatFeeCents;
      config.estimatedMinutes = input.patch.estimatedMinutes;
      if (input.origin !== null) {
        config.originLatitude = input.origin.latitude;
        config.originLongitude = input.origin.longitude;
      }
      config.updatedAt = new Date();
      await manager.save(DeliveryConfigEntity, config);

      if (input.zones !== null) {
        await this.writeZones(
          manager,
          input.tenantId,
          input.storeId,
          input.zones,
          input.patch.maxRadiusKm,
        );
      } else {
        const current = await this.zonesOf(manager, input.tenantId, input.storeId);
        assertDeliveryZones(current, input.patch.maxRadiusKm);
      }

      const snapshot = await this.load(manager, input.tenantId, input.storeId);
      if (snapshot === null) {
        throw configNotFound();
      }
      return snapshot;
    });
  }

  async replaceZones(
    tenantId: string,
    storeId: string,
    zones: DeliveryFeeZone[],
    tx?: TransactionContext,
  ): Promise<DeliveryZoneRecord[]> {
    return this.transact(tx, async (manager) => {
      const config = await this.lockConfig(manager, tenantId, storeId);
      await this.writeZones(
        manager,
        tenantId,
        storeId,
        zones,
        config.maxRadiusKm,
      );
      return this.zonesOf(manager, tenantId, storeId);
    });
  }

  async addZone(
    tenantId: string,
    storeId: string,
    zone: Omit<DeliveryFeeZone, 'sortOrder'>,
    tx?: TransactionContext,
  ): Promise<DeliveryZoneRecord> {
    return this.transact(tx, async (manager) => {
      const config = await this.lockConfig(manager, tenantId, storeId);
      const current = await this.zonesOf(manager, tenantId, storeId);
      const sortOrder =
        current.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
      const next = [
        ...current.map(toFeeZone),
        { ...zone, sortOrder },
      ];
      assertDeliveryZones(next, config.maxRadiusKm);
      const row: DeliveryZoneEntity = {
        id: randomUUID(),
        tenantId,
        storeId,
        fromKm: zone.fromKm,
        toKm: zone.toKm,
        feeCents: zone.feeCents,
        sortOrder,
      };
      await manager.insert(DeliveryZoneEntity, row);
      return toZone(row);
    });
  }

  async updateZone(
    tenantId: string,
    storeId: string,
    zoneId: string,
    patch: Partial<Omit<DeliveryFeeZone, 'sortOrder'>>,
    tx?: TransactionContext,
  ): Promise<DeliveryZoneRecord> {
    return this.transact(tx, async (manager) => {
      const config = await this.lockConfig(manager, tenantId, storeId);
      const current = await this.zonesOf(manager, tenantId, storeId);
      const target = current.find((zone) => zone.id === zoneId);
      if (target === undefined) {
        throw zoneNotFound();
      }
      const next = current.map((zone) =>
        zone.id === zoneId
          ? {
              ...toFeeZone(zone),
              fromKm: patch.fromKm ?? zone.fromKm,
              toKm: patch.toKm ?? zone.toKm,
              feeCents: patch.feeCents ?? zone.feeCents,
            }
          : toFeeZone(zone),
      );
      assertDeliveryZones(next, config.maxRadiusKm);
      target.fromKm = patch.fromKm ?? target.fromKm;
      target.toKm = patch.toKm ?? target.toKm;
      target.feeCents = patch.feeCents ?? target.feeCents;
      await manager.save(DeliveryZoneEntity, target);
      return toZone(target);
    });
  }

  async deleteZone(
    tenantId: string,
    storeId: string,
    zoneId: string,
    tx?: TransactionContext,
  ): Promise<void> {
    await this.transact(tx, async (manager) => {
      await this.lockConfig(manager, tenantId, storeId);
      const result = await manager.delete(DeliveryZoneEntity, {
        id: zoneId,
        tenantId,
        storeId,
      });
      if ((result.affected ?? 0) === 0) {
        throw zoneNotFound();
      }
    });
  }

  private async transact<T>(
    tx: TransactionContext | undefined,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    if (tx !== undefined) {
      return work(tx as unknown as EntityManager);
    }
    const dataSource = await this.database.ensure();
    return dataSource.transaction(work);
  }

  private async writeZones(
    manager: EntityManager,
    tenantId: string,
    storeId: string,
    zones: readonly DeliveryFeeZone[],
    maxRadiusKm: number,
  ): Promise<void> {
    const ordered = zones.map((zone, index) => ({
      fromKm: zone.fromKm,
      toKm: zone.toKm,
      feeCents: zone.feeCents,
      sortOrder: index,
    }));
    assertDeliveryZones(ordered, maxRadiusKm);
    await manager.delete(DeliveryZoneEntity, { tenantId, storeId });
    if (ordered.length === 0) {
      return;
    }
    await manager.insert(
      DeliveryZoneEntity,
      ordered.map((zone) => ({
        id: randomUUID(),
        tenantId,
        storeId,
        fromKm: zone.fromKm,
        toKm: zone.toKm,
        feeCents: zone.feeCents,
        sortOrder: zone.sortOrder,
      })),
    );
  }

  private async lockConfig(
    manager: EntityManager,
    tenantId: string,
    storeId: string,
  ): Promise<DeliveryConfigEntity> {
    const config = await manager.findOne(DeliveryConfigEntity, {
      where: { tenantId, storeId },
      lock: { mode: 'pessimistic_write' },
    });
    if (config === null) {
      throw configNotFound();
    }
    return config;
  }

  private async load(
    manager: EntityManager,
    tenantId: string,
    storeId: string,
  ): Promise<DeliveryPolicySnapshot | null> {
    const config = await manager.findOne(DeliveryConfigEntity, {
      where: { tenantId, storeId },
    });
    if (config === null) {
      return null;
    }
    return {
      config: toConfig(config),
      zones: await this.zonesOf(manager, tenantId, storeId),
    };
  }

  private async zonesOf(
    manager: EntityManager,
    tenantId: string,
    storeId: string,
  ): Promise<DeliveryZoneRecord[]> {
    const rows = await manager.find(DeliveryZoneEntity, {
      where: { tenantId, storeId },
      order: { sortOrder: 'ASC', fromKm: 'ASC' },
    });
    return rows.map(toZone);
  }
}

function toFeeZone(zone: DeliveryZoneRecord): DeliveryFeeZone {
  return {
    fromKm: zone.fromKm,
    toKm: zone.toKm,
    feeCents: zone.feeCents,
    sortOrder: zone.sortOrder,
  };
}

function toConfig(row: DeliveryConfigEntity): DeliveryConfigRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    storeId: row.storeId,
    deliveryEnabled: row.deliveryEnabled,
    pickupEnabled: row.pickupEnabled,
    maxRadiusKm: row.maxRadiusKm,
    feeMode: row.feeMode,
    flatFeeCents: row.flatFeeCents,
    estimatedMinutes: row.estimatedMinutes,
    originLatitude: row.originLatitude,
    originLongitude: row.originLongitude,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function toZone(row: DeliveryZoneEntity): DeliveryZoneRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    storeId: row.storeId,
    fromKm: row.fromKm,
    toKm: row.toKm,
    feeCents: row.feeCents,
    sortOrder: row.sortOrder,
  };
}

function configNotFound(): DomainException {
  return new DomainException(
    'DELIVERY_CONFIG_NOT_FOUND',
    'The delivery configuration was not found',
    404,
  );
}

function zoneNotFound(): DomainException {
  return new DomainException(
    'DELIVERY_ZONE_NOT_FOUND',
    'The delivery zone was not found',
    404,
  );
}
