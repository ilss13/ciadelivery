import { randomUUID } from 'node:crypto';
import {
  APP_CONFIG,
  AppConfig,
  DatabaseReady,
  DomainException,
} from '@ciadelivery/shared';
import { Inject, Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import {
  InitialStoreDraft,
  ProvisionedStore,
  Stores,
  TransactionContext,
  currentTenant,
} from '@ciadelivery/tenancy/domain';
import { StoreProfileUpdate, StoreRecord } from '../domain/current-store';
import { StoreEntity } from './store.entity';

@Injectable()
export class TypeOrmStores implements Stores {
  constructor(
    private readonly database: DatabaseReady,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async createInitialStore(
    draft: InitialStoreDraft,
    tx: TransactionContext,
  ): Promise<ProvisionedStore> {
    const manager = tx as unknown as EntityManager;
    const count = await manager.count(StoreEntity, {
      where: { tenantId: draft.tenantId },
    });
    if (count >= 1) {
      throw storeLimitReached();
    }

    const now = new Date();
    const record: StoreRecord = {
      id: randomUUID(),
      tenantId: draft.tenantId,
      name: draft.name,
      phone: draft.phone,
      address: draft.address,
      latitude: null,
      longitude: null,
      minimumOrderCents: 0,
      isManuallyClosed: false,
      timezone: this.config.storeTimezone,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await manager.insert(StoreEntity, toRow(record));
    } catch (error) {
      if (isMysqlDuplicate(error)) {
        throw storeLimitReached();
      }

      throw error;
    }

    return record;
  }

  async findByTenantId(tenantId: string): Promise<ProvisionedStore | null> {
    const dataSource = await this.database.ensure();
    const row = await dataSource.manager.findOne(StoreEntity, {
      where: { tenantId },
    });
    return row === null ? null : toRecord(row);
  }

  async findByTenantIds(
    tenantIds: readonly string[],
  ): Promise<ProvisionedStore[]> {
    if (tenantIds.length === 0) {
      return [];
    }

    const dataSource = await this.database.ensure();
    const rows = await dataSource.manager.find(StoreEntity, {
      where: { tenantId: In([...tenantIds]) },
    });
    return rows.map(toRecord);
  }

  async findForCurrentTenant(): Promise<StoreRecord | null> {
    const tenant = currentTenant();
    if (tenant === null) {
      throw new DomainException(
        'TENANT_NOT_FOUND',
        'The tenant was not found',
        404,
      );
    }

    const dataSource = await this.database.ensure();
    const row = await dataSource.manager.findOne(StoreEntity, {
      where: { tenantId: tenant.id },
    });
    return row === null ? null : toRecord(row);
  }

  async updateForCurrentTenant(
    patch: StoreProfileUpdate,
  ): Promise<StoreRecord> {
    const current = await this.findForCurrentTenant();
    if (current === null) {
      throw new DomainException(
        'STORE_NOT_FOUND',
        'The store was not found',
        404,
      );
    }

    const updated: StoreRecord = {
      ...current,
      name: patch.name,
      phone: patch.phone,
      address: patch.address,
      minimumOrderCents: patch.minimumOrderCents,
      isManuallyClosed: patch.isManuallyClosed,
      updatedAt: new Date(),
    };
    const dataSource = await this.database.ensure();
    const result = await dataSource.manager.update(
      StoreEntity,
      { id: current.id, tenantId: current.tenantId },
      {
        name: updated.name,
        phone: updated.phone,
        addressLine: updated.address.line,
        addressNumber: updated.address.number,
        district: updated.address.district,
        city: updated.address.city,
        state: updated.address.state,
        postalCode: updated.address.postalCode,
        minimumOrderCents: updated.minimumOrderCents,
        isManuallyClosed: updated.isManuallyClosed,
        updatedAt: updated.updatedAt,
      },
    );
    if (result.affected !== 1) {
      throw new DomainException(
        'STORE_NOT_FOUND',
        'The store was not found',
        404,
      );
    }

    return updated;
  }
}

function storeLimitReached(): DomainException {
  return new DomainException(
    'STORE_LIMIT_REACHED',
    'The tenant already has a store',
    409,
  );
}

function isMysqlDuplicate(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as {
    code?: string;
    driverError?: { code?: string };
  };
  return (
    candidate.code === 'ER_DUP_ENTRY' ||
    candidate.driverError?.code === 'ER_DUP_ENTRY'
  );
}

function toRow(record: StoreRecord): StoreEntity {
  return {
    id: record.id,
    tenantId: record.tenantId,
    name: record.name,
    phone: record.phone,
    addressLine: record.address.line,
    addressNumber: record.address.number,
    district: record.address.district,
    city: record.address.city,
    state: record.address.state,
    postalCode: record.address.postalCode,
    latitude: record.latitude,
    longitude: record.longitude,
    minimumOrderCents: record.minimumOrderCents,
    isManuallyClosed: record.isManuallyClosed,
    timezone: record.timezone,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toRecord(row: StoreEntity): StoreRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    phone: row.phone,
    address: {
      line: row.addressLine,
      number: row.addressNumber,
      district: row.district,
      city: row.city,
      state: row.state,
      postalCode: row.postalCode,
    },
    latitude: row.latitude,
    longitude: row.longitude,
    minimumOrderCents: row.minimumOrderCents,
    isManuallyClosed: row.isManuallyClosed,
    timezone: row.timezone,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}
