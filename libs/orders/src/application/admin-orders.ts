import { DomainException } from '@ciadelivery/shared';
import { CurrentStore } from '@ciadelivery/stores';
import { RequestActor } from '@ciadelivery/users';
import { requireActorStore } from '@ciadelivery/customers';
import { AdminOrderDetail, AdminOrderSummary } from '../domain/order';
import { orderListBounds } from '../domain/order-list';
import { OrderStatus } from '../domain/order-status';
import { OrderRepository } from '../domain/order-repository';

export interface AdminOrderListInput {
  page?: number;
  pageSize?: number;
  status?: readonly OrderStatus[];
  from?: string;
  to?: string;
}

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
    query: AdminOrderListInput,
  ): Promise<AdminOrderPage> {
    const store = await requireActorStore(actor, this.stores);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const bounds = orderListBounds(query.from, query.to);
    const listed = await this.orders.listForStore(store.tenantId, store.id, {
      page,
      pageSize,
      statuses: query.status ?? null,
      from: bounds.from,
      to: bounds.to,
    });
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

  async get(actor: RequestActor, orderId: string): Promise<AdminOrderDetail> {
    const store = await requireActorStore(actor, this.stores);
    const order = await this.orders.findDetailForStore(
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
