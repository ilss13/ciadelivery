import { randomUUID } from 'node:crypto';
import { DatabaseReady } from '@ciadelivery/shared';
import { Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import {
  NewOrderNotification,
  NotificationRecord,
  NotificationStore,
} from '../domain/notification';
import { newOrderNotificationCopy } from '../domain/realtime';
import { NotificationEntity } from './notification.entity';

@Injectable()
export class TypeOrmNotifications implements NotificationStore {
  constructor(private readonly database: DatabaseReady) {}

  async recordOrderCreated(input: NewOrderNotification): Promise<NotificationRecord> {
    const existing = await this.findByEventId(input.eventId);
    if (existing !== null) {
      return existing;
    }

    const copy = newOrderNotificationCopy(input.orderNumber);
    const row: NotificationEntity = {
      id: randomUUID(),
      tenantId: input.tenantId,
      storeId: input.storeId,
      type: 'order.created',
      title: copy.title,
      body: copy.body,
      orderId: input.orderId,
      eventId: input.eventId,
      readAt: null,
      createdAt: input.createdAt,
    };
    const dataSource = await this.database.ensure();
    try {
      await dataSource.manager.insert(NotificationEntity, row);
      return toRecord(row);
    } catch (error) {
      if (!isMysqlDuplicate(error)) {
        throw error;
      }
      const stored = await this.findByEventId(input.eventId);
      if (stored === null) {
        throw error;
      }
      return stored;
    }
  }

  async list(
    tenantId: string,
    storeId: string,
    page: number,
    pageSize: number,
  ): Promise<{ data: NotificationRecord[]; total: number }> {
    const dataSource = await this.database.ensure();
    const [rows, total] = await dataSource.manager.findAndCount(NotificationEntity, {
      where: { tenantId, storeId },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data: rows.map(toRecord), total };
  }

  async markRead(
    tenantId: string,
    storeId: string,
    id: string,
    readAt: Date,
  ): Promise<NotificationRecord | null> {
    const dataSource = await this.database.ensure();
    await dataSource.manager.update(
      NotificationEntity,
      { id, tenantId, storeId, readAt: IsNull() },
      { readAt },
    );
    const row = await dataSource.manager.findOne(NotificationEntity, {
      where: { id, tenantId, storeId },
    });
    return row === null ? null : toRecord(row);
  }

  private async findByEventId(eventId: string): Promise<NotificationRecord | null> {
    const dataSource = await this.database.ensure();
    const row = await dataSource.manager.findOne(NotificationEntity, {
      where: { eventId },
    });
    return row === null ? null : toRecord(row);
  }
}

function toRecord(row: NotificationEntity): NotificationRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    storeId: row.storeId,
    type: row.type,
    title: row.title,
    body: row.body,
    orderId: row.orderId,
    readAt: row.readAt === null ? null : new Date(row.readAt),
    createdAt: new Date(row.createdAt),
  };
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
