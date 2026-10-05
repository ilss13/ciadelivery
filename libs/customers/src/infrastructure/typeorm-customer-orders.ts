import { DatabaseReady } from '@ciadelivery/shared';
import { Injectable } from '@nestjs/common';
import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { EntityManager } from 'typeorm';
import { CustomerScope } from '../domain/customer';
import {
  CustomerOrders,
  ExportedOrder,
  ExportedOrderAddress,
  ExportedOrderItem,
} from '../domain/customer-orders';

interface OrderRow {
  id: string;
  order_number: number | string;
  status: string;
  fulfillment: string;
  customer_name: string;
  customer_phone: string;
  address_snapshot: string | ExportedOrderAddress | null;
  subtotal_cents: number | string;
  delivery_fee_cents: number | string;
  total_cents: number | string;
  notes: string | null;
  created_at: Date | string;
}

interface ItemRow {
  id: string;
  order_id: string;
  product_name: string;
  sku: string | null;
  unit_price_cents: number | string;
  quantity: number | string;
  notes: string | null;
  options_snapshot: unknown;
  subtotal_cents: number | string;
}

@Injectable()
export class TypeOrmCustomerOrders implements CustomerOrders {
  constructor(private readonly database: DatabaseReady) {}

  async list(scope: CustomerScope, customerId: string): Promise<ExportedOrder[]> {
    const manager = await this.manager();
    return this.read(manager, scope, customerId);
  }

  async anonymize(
    scope: CustomerScope,
    customerId: string,
    name: string,
    phone: string,
    tx: TransactionContext,
  ): Promise<void> {
    const manager = managerOf(tx);
    const rows: OrderRow[] = await manager.query(
      `SELECT id, address_snapshot
       FROM orders
       WHERE tenant_id = ? AND store_id = ? AND customer_id = ?`,
      [scope.tenantId, scope.storeId, customerId],
    );
    const updatedAt = new Date();
    for (const row of rows) {
      await manager.query(
        `UPDATE orders
         SET customer_name = ?, customer_phone = ?, address_snapshot = ?, updated_at = ?
         WHERE id = ? AND tenant_id = ? AND store_id = ? AND customer_id = ?`,
        [
          name,
          phone,
          JSON.stringify(cityOnly(parseJson(row.address_snapshot))),
          updatedAt,
          row.id,
          scope.tenantId,
          scope.storeId,
          customerId,
        ],
      );
    }
  }

  private async read(
    manager: EntityManager,
    scope: CustomerScope,
    customerId: string,
  ): Promise<ExportedOrder[]> {
    const rows: OrderRow[] = await manager.query(
      `SELECT id, order_number, status, fulfillment, customer_name, customer_phone,
              address_snapshot, subtotal_cents, delivery_fee_cents, total_cents,
              notes, created_at
       FROM orders
       WHERE tenant_id = ? AND store_id = ? AND customer_id = ?
       ORDER BY created_at ASC, id ASC`,
      [scope.tenantId, scope.storeId, customerId],
    );
    if (rows.length === 0) {
      return [];
    }
    const items: ItemRow[] = await manager.query(
      `SELECT id, order_id, product_name, sku, unit_price_cents, quantity, notes,
              options_snapshot, subtotal_cents
       FROM order_items
       WHERE tenant_id = ? AND order_id IN (${rows.map(() => '?').join(', ')})
       ORDER BY position ASC, id ASC`,
      [scope.tenantId, ...rows.map((row) => row.id)],
    );
    const byOrder = new Map<string, ExportedOrderItem[]>();
    for (const item of items) {
      const list = byOrder.get(item.order_id) ?? [];
      list.push({
        id: item.id,
        productName: item.product_name,
        sku: item.sku,
        unitPriceCents: Number(item.unit_price_cents),
        quantity: Number(item.quantity),
        notes: item.notes,
        options: readOptions(parseJson(item.options_snapshot)),
        subtotalCents: Number(item.subtotal_cents),
      });
      byOrder.set(item.order_id, list);
    }
    return rows.map((row) => ({
      id: row.id,
      orderNumber: Number(row.order_number),
      status: row.status,
      fulfillment: row.fulfillment,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      address: addressOf(parseJson(row.address_snapshot)),
      subtotalCents: Number(row.subtotal_cents),
      deliveryFeeCents: Number(row.delivery_fee_cents),
      totalCents: Number(row.total_cents),
      notes: row.notes,
      createdAt: new Date(row.created_at),
      items: byOrder.get(row.id) ?? [],
    }));
  }

  private async manager(): Promise<EntityManager> {
    const dataSource = await this.database.ensure();
    return dataSource.manager;
  }
}

function managerOf(tx: TransactionContext): EntityManager {
  return tx as unknown as EntityManager;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function readOptions(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function addressOf(value: unknown): ExportedOrderAddress | null {
  if (value === null || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  return {
    line: text(row['line']),
    number: text(row['number']),
    district: text(row['district']),
    city: text(row['city']),
    state: text(row['state']),
    postalCode: text(row['postalCode']),
    complement: row['complement'] === null || row['complement'] === undefined
      ? null
      : text(row['complement']),
    latitude: numberOrNull(row['latitude']),
    longitude: numberOrNull(row['longitude']),
  };
}

function cityOnly(value: unknown): ExportedOrderAddress | null {
  const address = addressOf(value);
  if (address === null) {
    return null;
  }
  return {
    line: '',
    number: '',
    district: '',
    city: address.city,
    state: address.state,
    postalCode: '',
    complement: null,
    latitude: null,
    longitude: null,
  };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
