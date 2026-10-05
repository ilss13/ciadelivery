import { PublicOrder } from '../checkout/order.client';

export interface TrackingEvent {
  orderId: string;
  status: string;
  orderNumber: number;
  occurredAt: string;
}

export function withChronologicalHistory(order: PublicOrder): PublicOrder {
  return {
    ...order,
    history: [...order.history].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    ),
  };
}

export function applyTrackingEvent(
  order: PublicOrder,
  event: TrackingEvent,
): PublicOrder | null {
  if (event.orderId !== order.orderId) {
    return null;
  }
  const alreadyListed = order.history.some(
    (entry) => entry.toStatus === event.status && entry.createdAt === event.occurredAt,
  );
  const history = alreadyListed
    ? order.history
    : [
        ...order.history,
        {
          toStatus: event.status,
          createdAt: event.occurredAt,
          note: null,
        },
      ];
  return withChronologicalHistory({
    ...order,
    status: event.status,
    history,
  });
}
