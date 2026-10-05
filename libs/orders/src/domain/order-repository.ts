import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { Fulfillment } from './delivery-quote';
import {
  AdminOrderDetail,
  AdminOrderSummary,
  CreatedOrder,
  OrderAddress,
  OrderOptionSnapshot,
  PublicOrder,
} from './order';
import { OrderStatus } from './order-status';

export interface IdempotencyRecord {
  tenantId: string;
  key: string;
  requestHash: string;
  statusCode: number;
  responseBody: CreatedOrder | null;
  createdAt: Date;
}

export interface NewOrderItem {
  id: string;
  tenantId: string;
  orderId: string;
  position: number;
  productId: string;
  productName: string;
  sku: string | null;
  unitPriceCents: number;
  quantity: number;
  notes: string | null;
  options: OrderOptionSnapshot[];
  subtotalCents: number;
}

export interface NewOrder {
  id: string;
  tenantId: string;
  storeId: string;
  customerId: string;
  orderNumber: number;
  fulfillment: Fulfillment;
  paymentMethodCode: string;
  paymentLabel: string;
  paymentInstructions: string | null;
  customerName: string;
  customerPhone: string;
  address: OrderAddress | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  notes: string | null;
  trackingTokenHash: string;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewOrderHistory {
  id: string;
  tenantId: string;
  orderId: string;
  createdAt: Date;
}

export interface OrderRepository {
  claimIdempotency(
    record: IdempotencyRecord,
    tx: TransactionContext,
  ): Promise<'claimed' | IdempotencyRecord>;
  completeIdempotency(
    tenantId: string,
    key: string,
    response: CreatedOrder,
    tx: TransactionContext,
  ): Promise<void>;
  allocateOrderNumber(
    tenantId: string,
    tx: TransactionContext,
  ): Promise<number>;
  insertOrder(
    order: NewOrder,
    items: readonly NewOrderItem[],
    history: NewOrderHistory,
    tx: TransactionContext,
  ): Promise<void>;
  findByTrackingTokenHash(hash: string): Promise<PublicOrder | null>;
  listForStore(
    tenantId: string,
    storeId: string,
    query: StoreOrderListQuery,
  ): Promise<{ data: AdminOrderSummary[]; total: number }>;
  findForStore(
    tenantId: string,
    storeId: string,
    orderId: string,
  ): Promise<AdminOrderSummary | null>;
  findDetailForStore(
    tenantId: string,
    storeId: string,
    orderId: string,
  ): Promise<AdminOrderDetail | null>;
  lockForStore(
    tenantId: string,
    storeId: string,
    orderId: string,
    tx: TransactionContext,
  ): Promise<AdminOrderSummary | null>;
  applyTransition(
    change: OrderStatusChange,
    tx: TransactionContext,
  ): Promise<boolean>;
}

export interface StoreOrderListQuery {
  page: number;
  pageSize: number;
  statuses: readonly OrderStatus[] | null;
  from: Date | null;
  to: Date | null;
}

export interface OrderStatusChange {
  tenantId: string;
  storeId: string;
  orderId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  actorId: string;
  note: string | null;
  historyId: string;
  updatedAt: Date;
}

export const ORDERS = Symbol('ORDERS');
