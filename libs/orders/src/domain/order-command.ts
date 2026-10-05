import { DomainException } from '@ciadelivery/shared';
import { Fulfillment } from './delivery-quote';
import { OrderStatus } from './order-status';

export const ORDER_COMMANDS = {
  accept: {
    to: 'ACCEPTED',
    eventType: 'order.accepted',
    note: 'none',
    pickupOnly: false,
  },
  reject: {
    to: 'REJECTED',
    eventType: 'order.rejected',
    note: 'optional',
    pickupOnly: false,
  },
  'start-preparation': {
    to: 'IN_PREPARATION',
    eventType: 'order.in_preparation',
    note: 'none',
    pickupOnly: false,
  },
  ready: {
    to: 'READY',
    eventType: 'order.ready',
    note: 'none',
    pickupOnly: false,
  },
  cancel: {
    to: 'CANCELLED',
    eventType: 'order.cancelled',
    note: 'required',
    pickupOnly: false,
  },
  'complete-pickup': {
    to: 'DELIVERED',
    eventType: 'order.delivered',
    note: 'none',
    pickupOnly: true,
  },
} as const satisfies Record<
  string,
  {
    to: OrderStatus;
    eventType: string;
    note: 'none' | 'optional' | 'required';
    pickupOnly: boolean;
  }
>;

export type OrderCommand = keyof typeof ORDER_COMMANDS;

export const ORDER_CREATED_EVENT = 'order.created';

export function assertPickupCompletion(fulfillment: Fulfillment): void {
  if (fulfillment !== 'PICKUP') {
    throw new DomainException(
      'DELIVERY_REQUIRES_COURIER',
      'Delivery fulfillment requires a courier',
      409,
    );
  }
}

export function resolveOrderNote(
  mode: 'none' | 'optional' | 'required',
  note: string | null,
): string | null {
  const trimmed = note?.trim() ?? '';
  if (mode === 'required' && trimmed.length === 0) {
    throw new DomainException(
      'VALIDATION_ERROR',
      'The request payload is invalid',
      400,
    );
  }
  if (trimmed.length > 280) {
    throw new DomainException(
      'VALIDATION_ERROR',
      'The request payload is invalid',
      400,
    );
  }
  if (mode === 'none' || trimmed.length === 0) {
    return null;
  }
  return trimmed;
}
