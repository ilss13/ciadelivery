import { randomUUID } from 'node:crypto';
import {
  APP_CONFIG,
  AddressInput,
  AppConfig,
  DatabaseReady,
  DomainException,
  GEOCODING,
  GeocodingProvider,
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
import {
  StoreCoordinates,
  StoreProfileUpdate,
  StoreRecord,
} from '../domain/current-store';
import { StoreEntity } from './store.entity';

@Injectable()
export class TypeOrmStores implements Stores {
  constructor(
    private readonly database: DatabaseReady,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(GEOCODING) private readonly geocoding: GeocodingProvider,
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

    const origin = await this.geocoding.geocode(toAddressInput(draft.address));
    const now = new Date();
    const record: StoreRecord = {
      id: randomUUID(),
      tenantId: draft.tenantId,
      name: draft.name,
      phone: draft.phone,
      address: draft.address,
      latitude: origin.latitude,
      longitude: origin.longitude,
      minimumOrderCents: 0,
      isManuallyClosed: false,
      published: false,
      estimatedPrepMinutes: 40,
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

    await manager.query(
      `INSERT INTO \`delivery_configs\` (
        \`id\`, \`tenant_id\`, \`store_id\`, \`delivery_enabled\`, \`pickup_enabled\`,
        \`max_radius_km\`, \`fee_mode\`, \`flat_fee_cents\`, \`estimated_minutes\`,
        \`origin_latitude\`, \`origin_longitude\`, \`created_at\`, \`updated_at\`
      ) VALUES (?, ?, ?, 1, 1, 8.00, 'FLAT', 0, 40, ?, ?, ?, ?)`,
      [
        randomUUID(),
        record.tenantId,
        record.id,
        record.latitude,
        record.longitude,
        now,
        now,
      ],
    );

    await manager.query(
      `INSERT INTO \`payment_methods\` (
        \`id\`, \`tenant_id\`, \`store_id\`, \`code\`, \`label\`, \`instructions\`, \`enabled\`, \`sort_order\`
      ) VALUES
        (?, ?, ?, 'CASH', 'Dinheiro', NULL, 1, 0),
        (?, ?, ?, 'CARD_ON_DELIVERY', 'Cartão na entrega', NULL, 0, 1),
        (?, ?, ?, 'PIX_MANUAL', 'PIX', NULL, 0, 2),
        (?, ?, ?, 'PAY_ON_PICKUP', 'Pagar na retirada', NULL, 1, 3)`,
      [
        randomUUID(),
        record.tenantId,
        record.id,
        randomUUID(),
        record.tenantId,
        record.id,
        randomUUID(),
        record.tenantId,
        record.id,
        randomUUID(),
        record.tenantId,
        record.id,
      ],
    );

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

  async findByScope(
    tenantId: string,
    storeId: string,
  ): Promise<StoreRecord | null> {
    const dataSource = await this.database.ensure();
    const row = await dataSource.manager.findOne(StoreEntity, {
      where: { id: storeId, tenantId },
    });
    return row === null ? null : toRecord(row);
  }

  async updateForCurrentTenant(
    patch: StoreProfileUpdate,
    coordinates: StoreCoordinates,
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
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
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
        latitude: updated.latitude,
        longitude: updated.longitude,
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
    await writeOrigin(dataSource.manager, updated);

    return updated;
  }

  async saveCoordinates(input: {
    tenantId: string;
    storeId: string;
    latitude: number;
    longitude: number;
  }): Promise<void> {
    const dataSource = await this.database.ensure();
    const updatedAt = new Date();
    const result = await dataSource.manager.update(
      StoreEntity,
      { id: input.storeId, tenantId: input.tenantId },
      {
        latitude: input.latitude,
        longitude: input.longitude,
        updatedAt,
      },
    );
    if (result.affected !== 1) {
      throw new DomainException(
        'STORE_NOT_FOUND',
        'The store was not found',
        404,
      );
    }
    await writeOrigin(dataSource.manager, {
      id: input.storeId,
      tenantId: input.tenantId,
      latitude: input.latitude,
      longitude: input.longitude,
      updatedAt,
    });
  }
}

function toAddressInput(address: {
  line: string;
  number: string;
  district: string;
  city: string;
  state: string;
  postalCode: string;
}): AddressInput {
  return { ...address, complement: null };
}

async function writeOrigin(
  manager: EntityManager,
  input: {
    id: string;
    tenantId: string;
    latitude: number | null;
    longitude: number | null;
    updatedAt: Date;
  },
): Promise<void> {
  await manager.query(
    `UPDATE \`delivery_configs\`
     SET \`origin_latitude\` = ?, \`origin_longitude\` = ?, \`updated_at\` = ?
     WHERE \`tenant_id\` = ? AND \`store_id\` = ?`,
    [
      input.latitude,
      input.longitude,
      input.updatedAt,
      input.tenantId,
      input.id,
    ],
  );
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
    published: record.published,
    estimatedPrepMinutes: record.estimatedPrepMinutes,
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
    published: row.published,
    estimatedPrepMinutes: row.estimatedPrepMinutes,
    timezone: row.timezone,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}
