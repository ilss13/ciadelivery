import { randomUUID } from 'node:crypto';
import { requireActorStore } from '@ciadelivery/customers';
import { DomainException, JsonLogger } from '@ciadelivery/shared';
import { CurrentStore } from '@ciadelivery/stores';
import { UnitOfWork } from '@ciadelivery/tenancy/domain';
import { RequestActor } from '@ciadelivery/users';
import { DomainEventPublisher } from '../domain/domain-event';
import { AdminOrderSummary } from '../domain/order';
import {
  ORDER_COMMANDS,
  OrderCommand,
  assertPickupCompletion,
  resolveOrderNote,
} from '../domain/order-command';
import { OrderRepository } from '../domain/order-repository';
import { OrderStateMachine } from '../domain/order-status';
import { orderEvent } from './order-events';

export class TransitionAdminOrder {
  private readonly logger = new JsonLogger();
  private readonly machine = new OrderStateMachine();

  constructor(
    private readonly orders: OrderRepository,
    private readonly stores: CurrentStore,
    private readonly events: DomainEventPublisher,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(
    actor: RequestActor,
    orderId: string,
    command: OrderCommand,
    note: string | null,
  ): Promise<AdminOrderSummary> {
    const store = await requireActorStore(actor, this.stores);
    const spec = ORDER_COMMANDS[command];
    const updated = await this.unitOfWork.run(async (tx) => {
      const order = await this.orders.lockForStore(
        store.tenantId,
        store.id,
        orderId,
        tx,
      );
      if (order === null) {
        throw new DomainException(
          'ORDER_NOT_FOUND',
          'The order was not found',
          404,
        );
      }
      if (spec.pickupOnly) {
        assertPickupCompletion(order.fulfillment);
      }
      this.machine.assertCanTransition(order.status, spec.to);
      const historyNote = resolveOrderNote(spec.note, note);
      const occurredAt = new Date();
      const applied = await this.orders.applyTransition(
        {
          tenantId: store.tenantId,
          storeId: store.id,
          orderId: order.id,
          fromStatus: order.status,
          toStatus: spec.to,
          actorId: actor.userId,
          note: historyNote,
          historyId: randomUUID(),
          updatedAt: occurredAt,
        },
        tx,
      );
      if (!applied) {
        throw new DomainException(
          'ORDER_INVALID_TRANSITION',
          'The requested order transition is not allowed',
          409,
        );
      }
      await this.events.publish(
        orderEvent({
          id: randomUUID(),
          tenantId: store.tenantId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          storeId: store.id,
          status: spec.to,
          fulfillment: order.fulfillment,
          type: spec.eventType,
          occurredAt,
        }),
        tx,
      );
      return {
        ...order,
        status: spec.to,
      };
    });

    this.logger.log(
      `Order ${updated.id} transitioned to ${updated.status}`,
      'TransitionAdminOrder',
    );
    return updated;
  }
}
