import { requireActorStore } from '@ciadelivery/customers';
import { DomainException } from '@ciadelivery/shared';
import { CurrentStore } from '@ciadelivery/stores';
import { RequestActor } from '@ciadelivery/users';
import { CourierOrderReader } from '../domain/courier-order-reader';
import {
  CourierHistoryItem,
  CourierTaskDetail,
  CourierTaskSummary,
} from '../domain/courier-task';
import { AdvanceDelivery } from './advance-delivery';

const HISTORY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export interface CourierHistoryPage {
  data: CourierHistoryItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export class CourierOrders {
  constructor(
    private readonly orders: CourierOrderReader,
    private readonly advance: AdvanceDelivery,
    private readonly stores: CurrentStore,
  ) {}

  async list(actor: RequestActor): Promise<CourierTaskSummary[]> {
    const store = await this.scope(actor);
    return this.orders.listActive(store.tenantId, store.id, actor.userId);
  }

  async get(actor: RequestActor, orderId: string): Promise<CourierTaskDetail> {
    const store = await this.scope(actor);
    const order = await this.orders.findOwned(
      store.tenantId,
      store.id,
      actor.userId,
      orderId,
    );
    if (order === null) {
      throw orderNotFound();
    }
    return order;
  }

  async start(actor: RequestActor, orderId: string): Promise<CourierTaskDetail> {
    await this.advance.startForCourier(actor, orderId);
    return this.get(actor, orderId);
  }

  async complete(
    actor: RequestActor,
    orderId: string,
  ): Promise<CourierTaskDetail> {
    await this.advance.completeForCourier(actor, orderId);
    return this.get(actor, orderId);
  }

  async history(
    actor: RequestActor,
    page: number,
    pageSize: number,
  ): Promise<CourierHistoryPage> {
    const store = await this.scope(actor);
    const since = new Date(Date.now() - HISTORY_WINDOW_MS);
    const listed = await this.orders.listHistory(
      store.tenantId,
      store.id,
      actor.userId,
      since,
      page,
      pageSize,
    );
    return {
      data: listed.data,
      page,
      pageSize,
      total: listed.total,
      totalPages:
        listed.total === 0 ? 0 : Math.ceil(listed.total / pageSize),
    };
  }

  private async scope(actor: RequestActor) {
    if (actor.role !== 'COURIER') {
      throw new DomainException('FORBIDDEN', 'The permission is required', 403);
    }
    return requireActorStore(actor, this.stores);
  }
}

function orderNotFound(): DomainException {
  return new DomainException('ORDER_NOT_FOUND', 'The order was not found', 404);
}
