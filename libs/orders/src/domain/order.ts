import { Fulfillment } from './delivery-quote';
import { OrderStatus } from './order-status';

export type OrderActorType = 'CUSTOMER' | 'USER' | 'SYSTEM';

export interface OrderAddress {
  line: string;
  number: string;
  district: string;
  city: string;
  state: string;
  postalCode: string;
  complement: string | null;
}

export interface OrderOptionSnapshot {
  optionId: string;
  groupName: string;
  name: string;
  priceCents: number;
}

export interface AdminOrderSummary {
  id: string;
  orderNumber: number;
  createdAt: Date;
  totalCents: number;
  status: OrderStatus;
  fulfillment: Fulfillment;
}

export interface OrderReviewItem {
  productName: string;
  quantity: number;
  notes: string | null;
  options: OrderOptionSnapshot[];
  subtotalCents: number;
}

export interface OrderReview {
  items: OrderReviewItem[];
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  paymentLabel: string;
  paymentInstructions: string | null;
}

export interface CreatedOrder {
  orderId: string;
  orderNumber: number;
  status: 'NEW';
  totalCents: number;
  trackingToken: string;
  trackingPath: string;
}

export interface PublicOrderItem {
  productId: string | null;
  productName: string;
  sku: string | null;
  unitPriceCents: number;
  quantity: number;
  notes: string | null;
  options: OrderOptionSnapshot[];
  subtotalCents: number;
}

export interface PublicOrderHistoryEntry {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorType: OrderActorType;
  note: string | null;
  createdAt: Date;
}

export interface PublicOrder {
  orderId: string;
  orderNumber: number;
  status: OrderStatus;
  fulfillment: Fulfillment;
  paymentMethodCode: string;
  paymentLabel: string;
  paymentInstructions: string | null;
  customerName: string;
  customerPhone: string;
  address: OrderAddress | null;
  notes: string | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  createdAt: Date;
  items: PublicOrderItem[];
  history: PublicOrderHistoryEntry[];
}

export function trackingPath(token: string): string {
  return `/pedido/${token}`;
}
