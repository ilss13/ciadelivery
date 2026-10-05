import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { io } from 'socket.io-client';
import { apiUrl } from '../../core/api-url';
import { SessionService } from '../../core/session.service';
import {
  CourierAddress,
  CourierOrder,
  CourierRealtimeEvent,
} from './courier-order';

export type CourierBoardMessage =
  | { kind: 'event'; event: CourierRealtimeEvent }
  | { kind: 'resync' };

export interface CourierHistoryPage {
  data: CourierOrder[];
  page: number;
  totalPages: number;
}

export interface CourierBoard {
  loadActive(): Observable<CourierOrder[]>;
  fetch(id: string): Observable<CourierOrder>;
  start(id: string): Observable<CourierOrder>;
  complete(id: string): Observable<CourierOrder>;
  history(page: number): Observable<CourierHistoryPage>;
  watch(): Observable<CourierBoardMessage>;
}

export const COURIER_BOARD = new InjectionToken<CourierBoard>('COURIER_BOARD');

interface OrderPayload {
  id: string;
  orderNumber: number;
  status: string;
  totalCents: number;
  address: CourierAddress | null;
  customerPhone?: string;
}

interface HistoryPayload {
  data: Array<{
    id: string;
    orderNumber: number;
    totalCents: number;
    deliveredAt: string;
    address: CourierAddress | null;
  }>;
  meta: { page: number; totalPages: number };
}

const REALTIME_EVENTS = [
  'order.courier_assigned',
  'order.out_for_delivery',
  'order.delivered',
] as const;

@Injectable({ providedIn: 'root' })
export class HttpCourierBoard implements CourierBoard {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  loadActive(): Observable<CourierOrder[]> {
    return this.http
      .get<{ data: OrderPayload[] }>(apiUrl('/api/v1/courier/orders'))
      .pipe(map((body) => body.data.map(toOrder)));
  }

  fetch(id: string): Observable<CourierOrder> {
    return this.http
      .get<OrderPayload>(apiUrl(`/api/v1/courier/orders/${id}`))
      .pipe(map(toOrder));
  }

  start(id: string): Observable<CourierOrder> {
    return this.http
      .post<OrderPayload>(apiUrl(`/api/v1/courier/orders/${id}/start`), {})
      .pipe(map(toOrder));
  }

  complete(id: string): Observable<CourierOrder> {
    return this.http
      .post<OrderPayload>(apiUrl(`/api/v1/courier/orders/${id}/complete`), {})
      .pipe(map(toOrder));
  }

  history(page: number): Observable<CourierHistoryPage> {
    return this.http
      .get<HistoryPayload>(apiUrl('/api/v1/courier/deliveries'), {
        params: { page: String(page), pageSize: '20' },
      })
      .pipe(
        map((body) => ({
          page: body.meta.page,
          totalPages: body.meta.totalPages,
          data: body.data.map((item) => ({
            id: item.id,
            orderNumber: item.orderNumber,
            status: 'DELIVERED',
            totalCents: item.totalCents,
            address: item.address,
          })),
        })),
      );
  }

  watch(): Observable<CourierBoardMessage> {
    return new Observable((subscriber) => {
      const token = this.session.accessToken();
      if (token === null) {
        subscriber.complete();
        return;
      }
      const socket = io(apiUrl('/realtime'), { auth: { token } });
      let opened = false;
      socket.on('connect', () => {
        if (opened) {
          subscriber.next({ kind: 'resync' });
        }
        opened = true;
      });
      for (const name of REALTIME_EVENTS) {
        socket.on(name, (payload: unknown) => {
          const event = readEvent(name, payload);
          if (event !== null) {
            subscriber.next({ kind: 'event', event });
          }
        });
      }
      return () => {
        socket.close();
      };
    });
  }
}

function toOrder(order: OrderPayload): CourierOrder {
  const card: CourierOrder = {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    totalCents: order.totalCents,
    address: order.address,
  };
  if (order.customerPhone !== undefined) {
    card.customerPhone = order.customerPhone;
  }
  return card;
}

function readEvent(event: string, payload: unknown): CourierRealtimeEvent | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const orderId = record['orderId'];
  const status = record['status'];
  const orderNumber = record['orderNumber'];
  const occurredAt = record['occurredAt'];
  if (
    typeof orderId !== 'string' ||
    typeof status !== 'string' ||
    typeof orderNumber !== 'number' ||
    typeof occurredAt !== 'string'
  ) {
    return null;
  }
  return { event, orderId, status, orderNumber, occurredAt };
}
