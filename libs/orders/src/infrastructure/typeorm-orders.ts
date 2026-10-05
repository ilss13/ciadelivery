import { DatabaseReady } from '@ciadelivery/shared';
import { Injectable } from '@nestjs/common';
import { TransactionContext } from '@ciadelivery/tenancy/domain';
import {
  Between,
  EntityManager,
  FindOptionsWhere,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import { Fulfillment } from '../domain/delivery-quote';
import {
  AdminOrderDetail,
  AdminOrderSummary,
  CreatedOrder,
  OrderAddress,
  OrderOptionSnapshot,
  PublicOrder,
} from '../domain/order';
import {
  IdempotencyRecord,
  NewOrder,
  NewOrderHistory,
  NewOrderItem,
  OrderRepository,
  OrderStatusChange,
  StoreOrderListQuery,
} from '../domain/order-repository';
import { OrderActorType } from '../domain/order';
import { OrderStatus, isOrderStatus } from '../domain/order-status';
import {
  IdempotencyRecordEntity,
  OrderEntity,
  OrderItemEntity,
  OrderStatusHistoryEntity,
} from './order.entities';

@Injectable()
export class TypeOrmOrders implements OrderRepository {
  constructor(private readonly database: DatabaseReady) {}

  async claimIdempotency(
    record: IdempotencyRecord,
    tx: TransactionContext,
  ): Promise<'claimed' | IdempotencyRecord> {
    const manager = managerOf(tx);
    try {
      await manager.insert(IdempotencyRecordEntity, {
        tenantId: record.tenantId,
        idempotencyKey: record.key,
        requestHash: record.requestHash,
        statusCode: record.statusCode,
        responseBody: record.responseBody,
        createdAt: record.createdAt,
      });
      return 'claimed';
    } catch (error) {
      if (!isMysqlDuplicate(error)) {
        throw error;
      }
    }

    const row = await manager
      .createQueryBuilder(IdempotencyRecordEntity, 'record')
      .setLock('pessimistic_write')
      .where('record.tenantId = :tenantId', { tenantId: record.tenantId })
      .andWhere('record.idempotencyKey = :idempotencyKey', {
        idempotencyKey: record.key,
      })
      .getOne();
    if (row === null) {
      throw new Error('The idempotency record disappeared');
    }
    return toIdempotency(row);
  }

  async completeIdempotency(
    tenantId: string,
    key: string,
    response: CreatedOrder,
    tx: TransactionContext,
  ): Promise<void> {
    const result = await managerOf(tx).update(
      IdempotencyRecordEntity,
      { tenantId, idempotencyKey: key },
      { statusCode: 201, responseBody: response },
    );
    if (result.affected !== 1) {
      throw new Error('The idempotency record was not stored');
    }
  }

  async allocateOrderNumber(
    tenantId: string,
    tx: TransactionContext,
  ): Promise<number> {
    const manager = managerOf(tx);
    await manager.query(
      `INSERT INTO \`tenant_order_counters\` (\`tenant_id\`, \`last_number\`)
       VALUES (?, 1)
       ON DUPLICATE KEY UPDATE \`last_number\` = \`last_number\` + 1`,
      [tenantId],
    );
    const rows: unknown = await manager.query(
      `SELECT \`last_number\` AS orderNumber
       FROM \`tenant_order_counters\`
       WHERE \`tenant_id\` = ?
       FOR UPDATE`,
      [tenantId],
    );
    const value = Number(readRow(rows)?.['orderNumber']);
    if (!Number.isInteger(value) || value < 1) {
      throw new Error('The order number could not be allocated');
    }
    return value;
  }

  async insertOrder(
    order: NewOrder,
    items: readonly NewOrderItem[],
    history: NewOrderHistory,
    tx: TransactionContext,
  ): Promise<void> {
    const manager = managerOf(tx);
    await manager.insert(OrderEntity, {
      id: order.id,
      tenantId: order.tenantId,
      storeId: order.storeId,
      customerId: order.customerId,
      orderNumber: order.orderNumber,
      status: 'NEW',
      fulfillment: order.fulfillment,
      source: 'STOREFRONT',
      paymentMethodCode: order.paymentMethodCode,
      paymentLabel: order.paymentLabel,
      paymentInstructions: order.paymentInstructions,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      addressSnapshot: order.address,
      subtotalCents: order.subtotalCents,
      deliveryFeeCents: order.deliveryFeeCents,
      totalCents: order.totalCents,
      notes: order.notes,
      trackingTokenHash: order.trackingTokenHash,
      idempotencyKey: order.idempotencyKey,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    });
    if (items.length > 0) {
      await manager.insert(
        OrderItemEntity,
        items.map((item) => ({
          id: item.id,
          tenantId: item.tenantId,
          orderId: item.orderId,
          position: item.position,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          unitPriceCents: item.unitPriceCents,
          quantity: item.quantity,
          notes: item.notes,
          optionsSnapshot: item.options,
          subtotalCents: item.subtotalCents,
        })),
      );
    }
    await manager.insert(OrderStatusHistoryEntity, {
      id: history.id,
      tenantId: history.tenantId,
      orderId: history.orderId,
      fromStatus: null,
      toStatus: 'NEW',
      actorType: 'CUSTOMER',
      actorId: null,
      note: null,
      createdAt: history.createdAt,
    });
  }

  async findByTrackingTokenHash(hash: string): Promise<PublicOrder | null> {
    const manager = await this.manager();
    const order = await manager.findOne(OrderEntity, {
      where: { trackingTokenHash: hash },
    });
    if (order === null) {
      return null;
    }
    const items = await manager.find(OrderItemEntity, {
      where: { tenantId: order.tenantId, orderId: order.id },
      order: { position: 'ASC', id: 'ASC' },
    });
    const history = await manager.find(OrderStatusHistoryEntity, {
      where: { tenantId: order.tenantId, orderId: order.id },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return toPublicOrder(order, items, history);
  }

  async listForStore(
    tenantId: string,
    storeId: string,
    query: StoreOrderListQuery,
  ): Promise<{ data: AdminOrderSummary[]; total: number }> {
    const manager = await this.manager();
    const where: FindOptionsWhere<OrderEntity> = { tenantId, storeId };
    if (query.statuses !== null && query.statuses.length > 0) {
      where.status = In([...query.statuses]);
    }
    if (query.from !== null && query.to !== null) {
      where.createdAt = Between(query.from, query.to);
    } else if (query.from !== null) {
      where.createdAt = MoreThanOrEqual(query.from);
    } else if (query.to !== null) {
      where.createdAt = LessThanOrEqual(query.to);
    }
    const [rows, total] = await manager.findAndCount(OrderEntity, {
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return { data: rows.map(toAdminOrder), total };
  }

  async findForStore(
    tenantId: string,
    storeId: string,
    orderId: string,
  ): Promise<AdminOrderSummary | null> {
    const manager = await this.manager();
    const row = await manager.findOne(OrderEntity, {
      where: { id: orderId, tenantId, storeId },
    });
    return row === null ? null : toAdminOrder(row);
  }

  async findDetailForStore(
    tenantId: string,
    storeId: string,
    orderId: string,
  ): Promise<AdminOrderDetail | null> {
    const manager = await this.manager();
    const order = await manager.findOne(OrderEntity, {
      where: { id: orderId, tenantId, storeId },
    });
    if (order === null) {
      return null;
    }
    const items = await manager.find(OrderItemEntity, {
      where: { tenantId, orderId },
      order: { position: 'ASC', id: 'ASC' },
    });
    const history = await manager.find(OrderStatusHistoryEntity, {
      where: { tenantId, orderId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return toAdminDetail(order, items, history);
  }

  async lockForStore(
    tenantId: string,
    storeId: string,
    orderId: string,
    tx: TransactionContext,
  ): Promise<AdminOrderSummary | null> {
    const row = await managerOf(tx)
      .createQueryBuilder(OrderEntity, 'order')
      .setLock('pessimistic_write')
      .where('order.id = :orderId', { orderId })
      .andWhere('order.tenantId = :tenantId', { tenantId })
      .andWhere('order.storeId = :storeId', { storeId })
      .getOne();
    return row === null ? null : toAdminOrder(row);
  }

  async applyTransition(
    change: OrderStatusChange,
    tx: TransactionContext,
  ): Promise<boolean> {
    const manager = managerOf(tx);
    const result = await manager.update(
      OrderEntity,
      {
        id: change.orderId,
        tenantId: change.tenantId,
        storeId: change.storeId,
        status: change.fromStatus,
      },
      { status: change.toStatus, updatedAt: change.updatedAt },
    );
    if (result.affected !== 1) {
      return false;
    }
    await manager.insert(OrderStatusHistoryEntity, {
      id: change.historyId,
      tenantId: change.tenantId,
      orderId: change.orderId,
      fromStatus: change.fromStatus,
      toStatus: change.toStatus,
      actorType: 'USER',
      actorId: change.actorId,
      note: change.note,
      createdAt: change.updatedAt,
    });
    return true;
  }

  private async manager(): Promise<EntityManager> {
    const dataSource = await this.database.ensure();
    return dataSource.manager;
  }
}

function managerOf(tx: TransactionContext): EntityManager {
  return tx as unknown as EntityManager;
}

function toIdempotency(row: IdempotencyRecordEntity): IdempotencyRecord {
  return {
    tenantId: row.tenantId,
    key: row.idempotencyKey,
    requestHash: row.requestHash,
    statusCode: Number(row.statusCode),
    responseBody: readCreated(row.responseBody),
    createdAt: new Date(row.createdAt),
  };
}

function toAdminOrder(order: OrderEntity): AdminOrderSummary {
  if (!isOrderStatus(order.status) || !isFulfillment(order.fulfillment)) {
    throw new Error('The stored order is invalid');
  }
  return {
    id: order.id,
    orderNumber: Number(order.orderNumber),
    createdAt: new Date(order.createdAt),
    totalCents: Number(order.totalCents),
    status: order.status,
    fulfillment: order.fulfillment,
    customerName: order.customerName,
  };
}

function toAdminDetail(
  order: OrderEntity,
  items: readonly OrderItemEntity[],
  history: readonly OrderStatusHistoryEntity[],
): AdminOrderDetail {
  const published = toPublicOrder(order, items, history);
  return {
    id: published.orderId,
    orderNumber: published.orderNumber,
    status: published.status,
    fulfillment: published.fulfillment,
    paymentMethodCode: published.paymentMethodCode,
    paymentLabel: published.paymentLabel,
    paymentInstructions: published.paymentInstructions,
    customerName: published.customerName,
    customerPhone: published.customerPhone,
    address: published.address,
    notes: published.notes,
    subtotalCents: published.subtotalCents,
    deliveryFeeCents: published.deliveryFeeCents,
    totalCents: published.totalCents,
    createdAt: published.createdAt,
    items: published.items,
    history: published.history,
  };
}

function toPublicOrder(
  order: OrderEntity,
  items: readonly OrderItemEntity[],
  history: readonly OrderStatusHistoryEntity[],
): PublicOrder {
  if (!isOrderStatus(order.status) || !isFulfillment(order.fulfillment)) {
    throw new Error('The stored order is invalid');
  }
  return {
    orderId: order.id,
    orderNumber: Number(order.orderNumber),
    status: order.status,
    fulfillment: order.fulfillment,
    paymentMethodCode: order.paymentMethodCode,
    paymentLabel: order.paymentLabel,
    paymentInstructions: order.paymentInstructions,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    address: readAddress(order.addressSnapshot),
    notes: order.notes,
    subtotalCents: Number(order.subtotalCents),
    deliveryFeeCents: Number(order.deliveryFeeCents),
    totalCents: Number(order.totalCents),
    createdAt: new Date(order.createdAt),
    items: items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      unitPriceCents: Number(item.unitPriceCents),
      quantity: Number(item.quantity),
      notes: item.notes,
      options: readOptions(item.optionsSnapshot),
      subtotalCents: Number(item.subtotalCents),
    })),
    history: history.map((entry) => ({
      fromStatus: readStatus(entry.fromStatus),
      toStatus: readRequiredStatus(entry.toStatus),
      actorType: readActor(entry.actorType),
      note: entry.note,
      createdAt: new Date(entry.createdAt),
    })),
  };
}

function readCreated(value: unknown): CreatedOrder | null {
  const parsed = readJson(value);
  if (parsed === null || typeof parsed !== 'object') {
    return null;
  }
  return parsed as CreatedOrder;
}

function readAddress(value: unknown): OrderAddress | null {
  const parsed = readJson(value);
  if (parsed === null || typeof parsed !== 'object') {
    return null;
  }
  return parsed as OrderAddress;
}

function readOptions(value: unknown): OrderOptionSnapshot[] {
  const parsed = readJson(value);
  return Array.isArray(parsed) ? (parsed as OrderOptionSnapshot[]) : [];
}

function readJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  return JSON.parse(value) as unknown;
}

function readStatus(value: string | null): OrderStatus | null {
  if (value === null) {
    return null;
  }
  return readRequiredStatus(value);
}

function readRequiredStatus(value: string): OrderStatus {
  if (!isOrderStatus(value)) {
    throw new Error('The stored order status is invalid');
  }
  return value;
}

function readActor(value: string): OrderActorType {
  if (value === 'CUSTOMER' || value === 'USER' || value === 'SYSTEM') {
    return value;
  }
  throw new Error('The stored order actor is invalid');
}

function isFulfillment(value: string): value is Fulfillment {
  return value === 'DELIVERY' || value === 'PICKUP';
}

function readRow(rows: unknown): Record<string, unknown> | null {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }
  const first = rows[0];
  if (typeof first !== 'object' || first === null) {
    return null;
  }
  return first as Record<string, unknown>;
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
