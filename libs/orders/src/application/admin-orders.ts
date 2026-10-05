import { DomainException } from '@ciadelivery/shared';
import { CurrentStore } from '@ciadelivery/stores';
import { RequestActor } from '@ciadelivery/users';
import { requireActorStore } from '@ciadelivery/customers';
import { AdminOrderSummary } from '../domain/order';
import { OrderRepository } from '../domain/order-repository';

export interface AdminOrderPage {
  data: AdminOrderSummary[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export class AdminOrders {
  constructor(
    private readonly orders: OrderRepository,
    private readonly stores: CurrentStore,
  ) {}

  async list(
    actor: RequestActor,
    page: number,
    pageSize: number,
  ): Promise<AdminOrderPage> {
    const store = await requireActorStore(actor, this.stores);
    const listed = await this.orders.listForStore(
      store.tenantId,
      store.id,
      page,
      pageSize,
    );
    return {
      data: listed.data,
      meta: {
        page,
        pageSize,
        total: listed.total,
        totalPages:
          listed.total === 0 ? 0 : Math.ceil(listed.total / pageSize),
      },
    };
  }

  async get(actor: RequestActor, orderId: string): Promise<AdminOrderSummary> {
    const store = await requireActorStore(actor, this.stores);
    const order = await this.orders.findForStore(
      store.tenantId,
      store.id,
      orderId,
    );
    if (order === null) {
      throw new DomainException(
        'ORDER_NOT_FOUND',
        'The order was not found',
        404,
      );
    }
    return order;
  }
}
