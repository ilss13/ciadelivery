import { CourierHistoryItem, CourierTaskDetail, CourierTaskSummary } from './courier-task';

export interface CourierOrderReader {
  listActive(
    tenantId: string,
    storeId: string,
    userId: string,
  ): Promise<CourierTaskSummary[]>;
  findOwned(
    tenantId: string,
    storeId: string,
    userId: string,
    orderId: string,
  ): Promise<CourierTaskDetail | null>;
  listHistory(
    tenantId: string,
    storeId: string,
    userId: string,
    since: Date,
    page: number,
    pageSize: number,
  ): Promise<{ data: CourierHistoryItem[]; total: number }>;
}

export const COURIER_ORDERS = Symbol('COURIER_ORDERS');
