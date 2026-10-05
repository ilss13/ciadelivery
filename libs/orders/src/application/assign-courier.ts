import { randomUUID } from 'node:crypto';
import { requireActorStore } from '@ciadelivery/customers';
import {
  Assignments,
  Couriers,
  assertCourierAssignable,
  assertOrderAssignable,
} from '@ciadelivery/delivery';
import { DomainException, JsonLogger } from '@ciadelivery/shared';
import { CurrentStore } from '@ciadelivery/stores';
import { UnitOfWork } from '@ciadelivery/tenancy/domain';
import { RequestActor } from '@ciadelivery/users';
import { DomainEventPublisher } from '../domain/domain-event';
import { AdminOrderSummary } from '../domain/order';
import { OrderRepository } from '../domain/order-repository';
import { orderEvent } from './order-events';

export class AssignCourier {
  private readonly logger = new JsonLogger();

  constructor(
    private readonly orders: OrderRepository,
    private readonly couriers: Couriers,
    private readonly assignments: Assignments,
    private readonly stores: CurrentStore,
    private readonly events: DomainEventPublisher,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(
    actor: RequestActor,
    orderId: string,
    courierId: string,
  ): Promise<AdminOrderSummary> {
    if (actor.role === 'COURIER') {
      throw forbidden();
    }
    const store = await requireActorStore(actor, this.stores);
    const assigned = await this.unitOfWork.run(async (tx) => {
      const order = await this.orders.lockForStore(
        store.tenantId,
        store.id,
        orderId,
        tx,
      );
      if (order === null) {
        throw orderNotFound();
      }
      assertOrderAssignable(order);
      const courier = await this.couriers.lockInStore(
        store.tenantId,
        store.id,
        courierId,
        tx,
      );
      assertCourierAssignable(courier);
      const existing = await this.assignments.lockByOrder(
        store.tenantId,
        order.id,
        tx,
      );
      if (existing !== null) {
        throw new DomainException(
          'ASSIGNMENT_EXISTS',
          'The order already has a courier assignment',
          409,
        );
      }
      const occurredAt = new Date();
      await this.assignments.insert(
        {
          id: randomUUID(),
          tenantId: store.tenantId,
          orderId: order.id,
          courierId: courier.id,
          status: 'ASSIGNED',
          assignedBy: actor.userId,
          assignedAt: occurredAt,
        },
        tx,
      );
      await this.events.publish(
        orderEvent({
          id: randomUUID(),
          tenantId: store.tenantId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          storeId: store.id,
          status: order.status,
          fulfillment: order.fulfillment,
          type: 'order.courier_assigned',
          occurredAt,
          courierUserId: courier.userId,
        }),
        tx,
      );
      return order;
    });
    this.logger.log(
      `Assigned courier ${courierId} to order ${assigned.id}`,
      'AssignCourier',
    );
    return assigned;
  }
}

function orderNotFound(): DomainException {
  return new DomainException('ORDER_NOT_FOUND', 'The order was not found', 404);
}

function forbidden(): DomainException {
  return new DomainException('FORBIDDEN', 'The permission is required', 403);
}
