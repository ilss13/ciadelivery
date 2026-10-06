export interface OrderNotice {
  tenantId: string;
  storeId: string;
  orderId: string;
  orderNumber: number;
  status: string;
  customerName: string;
  customerPhone: string;
  totalCents: number;
  source: 'STOREFRONT' | 'WHATSAPP' | 'TEST';
  storeName: string;
  hasTrackingToken: boolean;
}

export interface OrderNotices {
  find(tenantId: string, orderId: string): Promise<OrderNotice | null>;
}

export const ORDER_NOTICES = Symbol('ORDER_NOTICES');

export interface StatusEventRecord {
  id: string;
  tenantId: string;
  type: string;
  orderId: string;
}

export interface StatusEvents {
  find(id: string): Promise<StatusEventRecord | null>;
}

export const STATUS_EVENTS = Symbol('STATUS_EVENTS');
