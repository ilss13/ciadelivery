import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { io } from 'socket.io-client';
import { apiUrl } from '../../core/api-url';
import { TrackingEvent } from './tracking-timeline';

export type TrackingMessage =
  | { kind: 'event'; event: TrackingEvent }
  | { kind: 'reconnecting' }
  | { kind: 'resynced' };

export interface TrackingFeed {
  watch(trackingToken: string): Observable<TrackingMessage>;
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
export class SocketTrackingFeed implements TrackingFeed {
  watch(trackingToken: string): Observable<TrackingMessage> {
    return new Observable((subscriber) => {
      if (trackingToken.length === 0) {
        subscriber.complete();
        return;
      }
      const socket = io(apiUrl('/realtime'), {
        auth: { trackingToken },
      });
      let stopped = false;
      let connectedOnce = false;
      socket.on('connect', () => {
        if (connectedOnce && !stopped) {
          subscriber.next({ kind: 'resynced' });
        }
        connectedOnce = true;
      });
      socket.on('disconnect', () => {
        if (!stopped && connectedOnce) {
          subscriber.next({ kind: 'reconnecting' });
        }
      });
      socket.on('connect_error', () => {
        if (!stopped && !socket.connected) {
          subscriber.next({ kind: 'reconnecting' });
        }
      });
      for (const name of REALTIME_EVENTS) {
        socket.on(name, (payload: unknown) => {
          const event = readTrackingEvent(payload);
          if (event !== null && !stopped) {
            subscriber.next({ kind: 'event', event });
          }
        });
      }
      return () => {
        stopped = true;
        socket.close();
      };
    });
  }
}

export const TRACKING_FEED = new InjectionToken<TrackingFeed>('TRACKING_FEED', {
  factory: () => inject(SocketTrackingFeed),
});

function readTrackingEvent(payload: unknown): TrackingEvent | null {
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
  return { orderId, status, orderNumber, occurredAt };
}
