export interface NotificationRecord {
  id: string;
  tenantId: string;
  storeId: string;
  type: string;
  title: string;
  body: string;
  orderId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface NewOrderNotification {
  eventId: string;
  tenantId: string;
  storeId: string;
  orderId: string;
  orderNumber: number;
  createdAt: Date;
}

export interface NotificationStore {
  recordOrderCreated(input: NewOrderNotification): Promise<NotificationRecord>;
  list(
    tenantId: string,
    storeId: string,
    page: number,
    pageSize: number,
  ): Promise<{ data: NotificationRecord[]; total: number }>;
  markRead(
    tenantId: string,
    storeId: string,
    id: string,
    readAt: Date,
  ): Promise<NotificationRecord | null>;
}

export const NOTIFICATIONS = Symbol('NOTIFICATIONS');

export interface TrackingOrderScope {
  orderId: string;
  tenantId: string;
  storeId: string;
}

export interface TrackingOrderLookup {
  findByToken(trackingToken: string): Promise<TrackingOrderScope | null>;
}

export const TRACKING_ORDERS = Symbol('TRACKING_ORDERS');

export interface RealtimePublisher {
  publish(message: {
    event: string;
    rooms: string[];
    payload: Record<string, string | number>;
  }): Promise<void>;
}

export const REALTIME_PUBLISHER = Symbol('REALTIME_PUBLISHER');
