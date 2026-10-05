import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { EMPTY, Observable, expand, forkJoin, map, reduce } from 'rxjs';
import { io } from 'socket.io-client';
import { apiUrl } from '../../core/api-url';
import { SessionService } from '../../core/session.service';
import {
  FINISHED_ORDER_STATUSES,
  OPEN_ORDER_STATUSES,
  OrderCard,
  OrderRealtimeEvent,
  localDayBounds,
} from './order-board';

export type OrderAction =
  | 'accept'
  | 'reject'
  | 'start-preparation'
  | 'ready'
  | 'cancel'
  | 'complete-pickup';

export type OrderBoardMessage =
  | { kind: 'event'; event: OrderRealtimeEvent }
  | { kind: 'resync' };

export interface OrdersBoardStore {
  load(): Observable<OrderCard[]>;
  watch(): Observable<OrderBoardMessage>;
  fetch(id: string): Observable<OrderCard>;
  transition(
    id: string,
    action: OrderAction,
    note: string | null,
  ): Observable<OrderCard>;
}

export const ORDERS_BOARD_STORE = new InjectionToken<OrdersBoardStore>(
  'ORDERS_BOARD_STORE',
);

interface OrderPage {
  data: OrderPayload[];
  meta: { page: number; totalPages: number };
}

interface OrderPayload {
  id: string;
  orderNumber: number;
  createdAt: string;
  totalCents: number;
  status: string;
  fulfillment: string;
  customerName: string;
}

const REALTIME_EVENTS = [
  'order.created',
  'order.updated',
  'order.accepted',
  'order.rejected',
  'order.in_preparation',
  'order.ready',
  'order.delivered',
  'order.cancelled',
] as const;

@Injectable({ providedIn: 'root' })
export class HttpOrdersBoardStore implements OrdersBoardStore {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  load(): Observable<OrderCard[]> {
    const today = localDayBounds();
    return forkJoin([
      this.collect([...OPEN_ORDER_STATUSES], null, null),
      this.collect([...FINISHED_ORDER_STATUSES], today.from, today.to),
    ]).pipe(
      map(([openOrders, done]) => {
        const byId = new Map<string, OrderCard>();
        for (const order of [...openOrders, ...done]) {
          byId.set(order.id, order);
        }
        return [...byId.values()];
      }),
    );
  }

  watch(): Observable<OrderBoardMessage> {
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
          const event = readRealtimeEvent(name, payload);
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

  fetch(id: string): Observable<OrderCard> {
    return this.http
      .get<OrderPayload>(apiUrl(`/api/v1/admin/orders/${id}`))
      .pipe(map(toCard));
  }

  transition(
    id: string,
    action: OrderAction,
    note: string | null,
  ): Observable<OrderCard> {
    return this.http
      .post<OrderPayload>(apiUrl(`/api/v1/admin/orders/${id}/${action}`), note === null ? {} : { note })
      .pipe(map(toCard));
  }

  private collect(
    statuses: readonly string[],
    from: string | null,
    to: string | null,
  ): Observable<OrderCard[]> {
    const loadPage = (page: number) => {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: '100',
        status: statuses.join(','),
      };
      if (from !== null) {
        params['from'] = from;
      }
      if (to !== null) {
        params['to'] = to;
      }
      return this.http.get<OrderPage>(apiUrl('/api/v1/admin/orders'), { params });
    };
    return loadPage(1).pipe(
      expand((page) =>
        page.meta.page < page.meta.totalPages ? loadPage(page.meta.page + 1) : EMPTY,
      ),
      map((page) => page.data.map(toCard)),
      reduce((all, rows) => all.concat(rows), [] as OrderCard[]),
    );
  }
}

function toCard(order: OrderPayload): OrderCard {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    totalCents: order.totalCents,
    status: order.status,
    fulfillment: order.fulfillment,
    customerName: order.customerName,
  };
}

function readRealtimeEvent(
  event: string,
  payload: unknown,
): OrderRealtimeEvent | null {
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
