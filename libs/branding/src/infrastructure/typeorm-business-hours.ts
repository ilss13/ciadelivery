import { randomUUID } from 'node:crypto';
import { DatabaseReady } from '@ciadelivery/shared';
import { CURRENT_STORE, CurrentStore } from '@ciadelivery/stores';
import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessDay,
  assertBusinessHours,
} from '../domain/business-hours';
import { BusinessHoursRepository } from '../domain/business-hours-repository';
import { BusinessHourEntity } from './business-hour.entity';
import { requireCurrentStore } from './current-store-scope';

@Injectable()
export class TypeOrmBusinessHours implements BusinessHoursRepository {
  constructor(
    private readonly database: DatabaseReady,
    @Inject(CURRENT_STORE) private readonly stores: CurrentStore,
  ) {}

  async listCurrent(): Promise<BusinessDay[]> {
    const store = await requireCurrentStore(this.stores);
    const dataSource = await this.database.ensure();
    const rows = await dataSource.manager.find(BusinessHourEntity, {
      where: { tenantId: store.tenantId, storeId: store.id },
      order: { weekday: 'ASC' },
    });
    return rows.map(toDay);
  }

  async replace(days: readonly BusinessDay[]): Promise<BusinessDay[]> {
    const normalized = assertBusinessHours(days);
    const store = await requireCurrentStore(this.stores);
    const dataSource = await this.database.ensure();
    await dataSource.transaction(async (manager) => {
      await manager.delete(BusinessHourEntity, {
        tenantId: store.tenantId,
        storeId: store.id,
      });
      await manager.insert(
        BusinessHourEntity,
        normalized.map((day) => ({
          id: randomUUID(),
          tenantId: store.tenantId,
          storeId: store.id,
          weekday: day.weekday,
          opensAt: day.opensAt,
          closesAt: day.closesAt,
          closed: day.closed,
        })),
      );
    });
    return normalized;
  }
}

function toDay(row: BusinessHourEntity): BusinessDay {
  return {
    weekday: Number(row.weekday),
    opensAt: row.opensAt,
    closesAt: row.closesAt,
    closed: row.closed,
  };
}
