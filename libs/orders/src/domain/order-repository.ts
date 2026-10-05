import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { Fulfillment } from './delivery-quote';
import {
  AdminOrderSummary,
  CreatedOrder,
  OrderAddress,
  OrderOptionSnapshot,
  PublicOrder,
} from './order';

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
    page: number,
    pageSize: number,
  ): Promise<{ data: AdminOrderSummary[]; total: number }>;
  findForStore(
    tenantId: string,
    storeId: string,
    orderId: string,
  ): Promise<AdminOrderSummary | null>;
}

export const ORDERS = Symbol('ORDERS');
