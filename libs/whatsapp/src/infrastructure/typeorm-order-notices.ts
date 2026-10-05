import { DatabaseReady } from '@ciadelivery/shared';
import { Injectable } from '@nestjs/common';
import {
  OrderNotice,
  OrderNotices,
  StatusEventRecord,
  StatusEvents,
} from '../domain/order-notices.port';

interface OrderRow {
  tenantId: string;
  storeId: string;
  orderId: string;
  orderNumber: number | string;
  status: string;
  customerName: string;
  customerPhone: string;
  totalCents: number | string;
  storeName: string;
  trackingTokenHash: string | null;
}

interface EventRow {
  id: string;
  tenantId: string;
  type: string;
  orderId: string;
}

@Injectable()
export class TypeOrmOrderNotices implements OrderNotices {
  constructor(private readonly database: DatabaseReady) {}

  async find(tenantId: string, orderId: string): Promise<OrderNotice | null> {
    const source = await this.database.ensure();
    const rows: OrderRow[] = await source.query(
      `SELECT o.tenant_id AS tenantId,
              o.store_id AS storeId,
              o.id AS orderId,
              o.order_number AS orderNumber,
              o.status AS status,
              o.customer_name AS customerName,
              o.customer_phone AS customerPhone,
              o.total_cents AS totalCents,
              s.name AS storeName,
              o.tracking_token_hash AS trackingTokenHash
         FROM orders o
         INNER JOIN stores s
           ON s.id = o.store_id AND s.tenant_id = o.tenant_id
        WHERE o.tenant_id = ? AND o.id = ?
        LIMIT 1`,
      [tenantId, orderId],
    );
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return {
      tenantId: row.tenantId,
      storeId: row.storeId,
      orderId: row.orderId,
      orderNumber: Number(row.orderNumber),
      status: row.status,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      totalCents: Number(row.totalCents),
      storeName: row.storeName,
      hasTrackingToken:
        row.trackingTokenHash !== null && row.trackingTokenHash.length > 0,
    };
  }
}

@Injectable()
export class TypeOrmStatusEvents implements StatusEvents {
  constructor(private readonly database: DatabaseReady) {}

  async find(id: string): Promise<StatusEventRecord | null> {
    const source = await this.database.ensure();
    const rows: EventRow[] = await source.query(
      `SELECT id, tenant_id AS tenantId, type, aggregate_id AS orderId
         FROM outbox_events
        WHERE id = ?
        LIMIT 1`,
      [id],
    );
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return {
      id: row.id,
      tenantId: row.tenantId,
      type: row.type,
      orderId: row.orderId,
    };
  }
}
