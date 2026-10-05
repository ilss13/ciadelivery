import { DomainException } from '@ciadelivery/shared';

export const ASSIGNMENT_STATUSES = [
  'ASSIGNED',
  'OUT',
  'DELIVERED',
  'CANCELLED',
] as const;

export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export interface AssignmentRecord {
  id: string;
  tenantId: string;
  orderId: string;
  courierId: string;
  courierUserId: string;
  status: AssignmentStatus;
  assignedBy: string;
  assignedAt: Date;
  outAt: Date | null;
  deliveredAt: Date | null;
}

export function assertOrderAssignable(order: {
  fulfillment: string;
  status: string;
}): void {
  if (order.fulfillment !== 'DELIVERY') {
    throw new DomainException(
      'PICKUP_NOT_ASSIGNABLE',
      'Pickup orders cannot be assigned to a courier',
      409,
    );
  }
  if (order.status !== 'READY') {
    throw new DomainException(
      'ORDER_NOT_READY',
      'Only a ready delivery can be assigned',
      409,
    );
  }
}

export function assertCourierAssignable(
  courier: { active: boolean } | null,
): asserts courier is { active: boolean } {
  if (courier === null || !courier.active) {
    throw new DomainException(
      'COURIER_NOT_FOUND',
      'The courier was not found',
      404,
    );
  }
}

export function assertCanDispatch(
  order: { fulfillment: string; status: string },
  assignment: { status: string } | null,
): void {
  if (order.fulfillment !== 'DELIVERY' || order.status !== 'READY') {
    throw new DomainException(
      'ORDER_INVALID_TRANSITION',
      'The requested order transition is not allowed',
      409,
    );
  }
  if (assignment === null || assignment.status !== 'ASSIGNED') {
    throw new DomainException(
      'COURIER_REQUIRED',
      'A courier assignment is required',
      409,
    );
  }
}

export function assertCanDeliver(order: {
  fulfillment: string;
  status: string;
}): void {
  if (order.fulfillment !== 'DELIVERY' || order.status !== 'OUT_FOR_DELIVERY') {
    throw new DomainException(
      'ORDER_INVALID_TRANSITION',
      'The requested order transition is not allowed',
      409,
    );
  }
}
