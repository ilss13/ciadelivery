import { DatabaseReady } from '@ciadelivery/shared';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  CourierAddressView,
  CourierHistoryItem,
  CourierTaskDetail,
  CourierTaskSummary,
} from '../domain/courier-task';
import { CourierOrderReader } from '../domain/courier-order-reader';
import { OrderAddress } from '../domain/order';
import { OrderStatus, isOrderStatus } from '../domain/order-status';

const ACTIVE = `
  SELECT
    o.id AS id,
    o.order_number AS orderNumber,
    o.status AS status,
    o.total_cents AS totalCents,
    o.customer_phone AS customerPhone,
    o.address_snapshot AS addressSnapshot
  FROM delivery_assignments a
  INNER JOIN couriers c
    ON c.id = a.courier_id AND c.tenant_id = a.tenant_id
  INNER JOIN orders o
    ON o.id = a.order_id AND o.tenant_id = a.tenant_id
  WHERE a.tenant_id = ?
    AND o.store_id = ?
    AND c.store_id = ?
    AND c.user_id = ?
    AND a.status IN ('ASSIGNED', 'OUT')
  ORDER BY a.assigned_at ASC, o.id ASC
`;

@Injectable()
export class TypeOrmCourierOrders implements CourierOrderReader {
  constructor(private readonly database: DatabaseReady) {}

  async listActive(
    tenantId: string,
    storeId: string,
    userId: string,
  ): Promise<CourierTaskSummary[]> {
    const rows = await this.query<TaskRow>(ACTIVE, [tenantId, storeId, storeId, userId]);
    return rows.map((row) => {
      const task = toTask(row);
      return {
        id: task.id,
        orderNumber: task.orderNumber,
        status: task.status,
        totalCents: task.totalCents,
        address: task.address,
      };
    });
  }

  async findOwned(
    tenantId: string,
    storeId: string,
    userId: string,
    orderId: string,
  ): Promise<CourierTaskDetail | null> {
    const rows = await this.query<TaskRow>(
      `SELECT
         o.id AS id,
         o.order_number AS orderNumber,
         o.status AS status,
         o.total_cents AS totalCents,
         o.customer_phone AS customerPhone,
         o.address_snapshot AS addressSnapshot
       FROM delivery_assignments a
       INNER JOIN couriers c
         ON c.id = a.courier_id AND c.tenant_id = a.tenant_id
       INNER JOIN orders o
         ON o.id = a.order_id AND o.tenant_id = a.tenant_id
       WHERE a.tenant_id = ?
         AND o.store_id = ?
         AND c.store_id = ?
         AND c.user_id = ?
         AND a.status <> 'CANCELLED'
         AND o.id = ?
       LIMIT 1`,
      [tenantId, storeId, storeId, userId, orderId],
    );
    const row = rows[0];
    return row === undefined ? null : toTask(row);
  }

  async listHistory(
    tenantId: string,
    storeId: string,
    userId: string,
    since: Date,
    page: number,
    pageSize: number,
  ): Promise<{ data: CourierHistoryItem[]; total: number }> {
    const filters = `
      FROM delivery_assignments a
      INNER JOIN couriers c
        ON c.id = a.courier_id AND c.tenant_id = a.tenant_id
      INNER JOIN orders o
        ON o.id = a.order_id AND o.tenant_id = a.tenant_id
      WHERE a.tenant_id = ?
        AND o.store_id = ?
        AND c.store_id = ?
        AND c.user_id = ?
        AND a.status = 'DELIVERED'
        AND a.delivered_at >= ?
    `;
    const params = [tenantId, storeId, storeId, userId, since];
    const totals = await this.query<{ total: number | string }>(
      `SELECT COUNT(*) AS total ${filters}`,
      params,
    );
    const total = Number(totals[0]?.total ?? 0);
    const rows = await this.query<HistoryRow>(
      `SELECT
         o.id AS id,
         o.order_number AS orderNumber,
         o.total_cents AS totalCents,
         o.address_snapshot AS addressSnapshot,
         a.delivered_at AS deliveredAt
       ${filters}
       ORDER BY a.delivered_at DESC, o.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize],
    );
    return {
      total,
      data: rows.map((row) => ({
        id: row.id,
        orderNumber: Number(row.orderNumber),
        totalCents: Number(row.totalCents),
        deliveredAt: new Date(row.deliveredAt),
        address: readAddress(row.addressSnapshot),
      })),
    };
  }

  private async query<T>(sql: string, params: readonly unknown[]): Promise<T[]> {
    const manager = await this.manager();
    return manager.query(sql, [...params]);
  }

  private async manager(): Promise<EntityManager> {
    const dataSource = await this.database.ensure();
    return dataSource.manager;
  }
}

interface TaskRow {
  id: string;
  orderNumber: number | string;
  status: string;
  totalCents: number | string;
  customerPhone: string;
  addressSnapshot: unknown;
}

interface HistoryRow {
  id: string;
  orderNumber: number | string;
  totalCents: number | string;
  addressSnapshot: unknown;
  deliveredAt: string | Date;
}

function toTask(row: TaskRow): CourierTaskDetail {
  if (!isOrderStatus(row.status)) {
    throw new Error('The stored order status is invalid');
  }
  const status: OrderStatus = row.status;
  return {
    id: row.id,
    orderNumber: Number(row.orderNumber),
    status,
    totalCents: Number(row.totalCents),
    customerPhone: row.customerPhone,
    address: readAddress(row.addressSnapshot),
  };
}

function readAddress(value: unknown): CourierAddressView | null {
  const parsed = typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
  if (parsed === null || typeof parsed !== 'object') {
    return null;
  }
  const address = parsed as OrderAddress;
  if (typeof address.line !== 'string' || typeof address.number !== 'string') {
    return null;
  }
  return {
    line: address.line,
    number: address.number,
    district: address.district,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    complement: address.complement ?? null,
  };
}
