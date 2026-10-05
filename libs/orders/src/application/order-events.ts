import { DomainEventDraft } from '../domain/domain-event';
import { Fulfillment } from '../domain/delivery-quote';
import { OrderStatus } from '../domain/order-status';

export function orderEvent(input: {
  id: string;
  tenantId: string;
  orderId: string;
  orderNumber: number;
  storeId: string;
  status: OrderStatus;
  fulfillment: Fulfillment;
  type: string;
  occurredAt: Date;
  courierUserId?: string;
}): DomainEventDraft {
  return {
    id: input.id,
    tenantId: input.tenantId,
    aggregateType: 'order',
    aggregateId: input.orderId,
    type: input.type,
    availableAt: input.occurredAt,
    payload: {
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      storeId: input.storeId,
      status: input.status,
      fulfillment: input.fulfillment,
      occurredAt: input.occurredAt.toISOString(),
      ...(input.courierUserId === undefined
        ? {}
        : { courierUserId: input.courierUserId }),
    },
  };
}
