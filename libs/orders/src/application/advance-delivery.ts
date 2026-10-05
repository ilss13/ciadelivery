import { randomUUID } from 'node:crypto';
import { actorTypeOf, AuditLogs, recordAudit } from '@ciadelivery/audit';
import { requireActorStore } from '@ciadelivery/customers';
import {
  Assignments,
  assertCanDeliver,
  assertCanDispatch,
} from '@ciadelivery/delivery';
import { DomainException, JsonLogger } from '@ciadelivery/shared';
import { CurrentStore } from '@ciadelivery/stores';
import { UnitOfWork } from '@ciadelivery/tenancy/domain';
import { RequestActor } from '@ciadelivery/users';
import { DomainEventPublisher } from '../domain/domain-event';
import { AdminOrderSummary } from '../domain/order';
import { OrderRepository } from '../domain/order-repository';
import { orderEvent } from './order-events';

export class AdvanceDelivery {
  private readonly logger = new JsonLogger();

  constructor(
    private readonly orders: OrderRepository,
    private readonly assignments: Assignments,
    private readonly stores: CurrentStore,
    private readonly events: DomainEventPublisher,
    private readonly unitOfWork: UnitOfWork,
    private readonly audit: AuditLogs,
  ) {}

  dispatch(actor: RequestActor, orderId: string): Promise<AdminOrderSummary> {
    return this.move(actor, orderId, 'dispatch', false);
  }

  deliver(actor: RequestActor, orderId: string): Promise<AdminOrderSummary> {
    return this.move(actor, orderId, 'deliver', false);
  }

  startForCourier(
    actor: RequestActor,
    orderId: string,
  ): Promise<AdminOrderSummary> {
    assertCourier(actor);
    return this.move(actor, orderId, 'dispatch', true);
  }

  completeForCourier(
    actor: RequestActor,
    orderId: string,
  ): Promise<AdminOrderSummary> {
    assertCourier(actor);
    return this.move(actor, orderId, 'deliver', true);
  }

  private async move(
    actor: RequestActor,
    orderId: string,
    action: 'dispatch' | 'deliver',
    courierScoped: boolean,
  ): Promise<AdminOrderSummary> {
    if (!courierScoped && actor.role === 'COURIER') {
      throw forbidden();
    }
    const store = await requireActorStore(actor, this.stores);
    const updated = await this.unitOfWork.run(async (tx) => {
      const order = await this.orders.lockForStore(
        store.tenantId,
        store.id,
        orderId,
        tx,
      );
      if (order === null) {
        throw orderNotFound();
      }
      const assignment = await this.assignments.lockByOrder(
        store.tenantId,
        order.id,
        tx,
      );
      if (
        courierScoped &&
        (assignment === null || assignment.courierUserId !== actor.userId)
      ) {
        throw orderNotFound();
      }
      const occurredAt = new Date();
      if (action === 'dispatch') {
        assertCanDispatch(order, assignment);
        const applied = await this.orders.applyTransition(
          {
            tenantId: store.tenantId,
            storeId: store.id,
            orderId: order.id,
            fromStatus: 'READY',
            toStatus: 'OUT_FOR_DELIVERY',
            actorId: actor.userId,
            note: null,
            historyId: randomUUID(),
            updatedAt: occurredAt,
          },
          tx,
        );
        const marked = await this.assignments.markOut(
          store.tenantId,
          order.id,
          occurredAt,
          tx,
        );
        if (!applied || !marked || assignment === null) {
          throw invalidTransition();
        }
        await this.events.publish(
          orderEvent({
            id: randomUUID(),
            tenantId: store.tenantId,
            orderId: order.id,
            orderNumber: order.orderNumber,
            storeId: store.id,
            status: 'OUT_FOR_DELIVERY',
            fulfillment: order.fulfillment,
            type: 'order.out_for_delivery',
            occurredAt,
            courierUserId: assignment.courierUserId,
          }),
          tx,
        );
        await recordAudit(this.audit, tx, {
          tenantId: store.tenantId,
          actorId: actor.userId,
          actorType: actorTypeOf(actor.role),
          action: 'order.out_for_delivery',
          entityType: 'order',
          entityId: order.id,
          before: { status: order.status },
          changes: { status: 'OUT_FOR_DELIVERY' },
        });
        return { ...order, status: 'OUT_FOR_DELIVERY' as const };
      }

      assertCanDeliver(order);
      const applied = await this.orders.applyTransition(
        {
          tenantId: store.tenantId,
          storeId: store.id,
          orderId: order.id,
          fromStatus: 'OUT_FOR_DELIVERY',
          toStatus: 'DELIVERED',
          actorId: actor.userId,
          note: null,
          historyId: randomUUID(),
          updatedAt: occurredAt,
        },
        tx,
      );
      if (!applied) {
        throw invalidTransition();
      }
      if (assignment !== null && assignment.status === 'OUT') {
        await this.assignments.markDelivered(
          store.tenantId,
          order.id,
          occurredAt,
          tx,
        );
      }
      await this.events.publish(
        orderEvent({
          id: randomUUID(),
          tenantId: store.tenantId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          storeId: store.id,
          status: 'DELIVERED',
          fulfillment: order.fulfillment,
          type: 'order.delivered',
          occurredAt,
          ...(assignment === null
            ? {}
            : { courierUserId: assignment.courierUserId }),
        }),
        tx,
      );
      await recordAudit(this.audit, tx, {
        tenantId: store.tenantId,
        actorId: actor.userId,
        actorType: actorTypeOf(actor.role),
        action: 'order.delivered',
        entityType: 'order',
        entityId: order.id,
        before: { status: order.status },
        changes: { status: 'DELIVERED' },
      });
      return { ...order, status: 'DELIVERED' as const };
    });
    this.logger.log(
      `Order ${updated.id} transitioned to ${updated.status}`,
      'AdvanceDelivery',
    );
    return updated;
  }
}

function assertCourier(actor: RequestActor): void {
  if (actor.role !== 'COURIER') {
    throw forbidden();
  }
}

function orderNotFound(): DomainException {
  return new DomainException('ORDER_NOT_FOUND', 'The order was not found', 404);
}

function invalidTransition(): DomainException {
  return new DomainException(
    'ORDER_INVALID_TRANSITION',
    'The requested order transition is not allowed',
    409,
  );
}

function forbidden(): DomainException {
  return new DomainException('FORBIDDEN', 'The permission is required', 403);
}
