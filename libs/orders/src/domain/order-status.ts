import { DomainException } from '@ciadelivery/shared';

export const ORDER_STATUSES = [
  'NEW',
  'ACCEPTED',
  'IN_PREPARATION',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'REJECTED',
  'CANCELLED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  NEW: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['IN_PREPARATION', 'CANCELLED'],
  IN_PREPARATION: ['READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  REJECTED: [],
  CANCELLED: [],
};

export class OrderStateMachine {
  assertCanTransition(from: OrderStatus, to: OrderStatus): void {
    assertCanTransition(from, to);
  }
}

export function assertCanTransition(from: OrderStatus, to: OrderStatus): void {
  if (!TRANSITIONS[from].includes(to)) {
    throw new DomainException(
      'ORDER_INVALID_TRANSITION',
      'The requested order transition is not allowed',
      409,
    );
  }
}

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}
