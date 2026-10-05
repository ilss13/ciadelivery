import { DomainException } from '@ciadelivery/shared';
import { requireActorStore } from '@ciadelivery/customers';
import { CurrentStore } from '@ciadelivery/stores';
import { RequestActor } from '@ciadelivery/users';
import {
  NotificationRecord,
  NotificationStore,
} from '../domain/notification';

export interface NotificationPage {
  data: NotificationRecord[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export class AdminNotifications {
  constructor(
    private readonly notifications: NotificationStore,
    private readonly stores: CurrentStore,
  ) {}

  async list(
    actor: RequestActor,
    page: number,
    pageSize: number,
  ): Promise<NotificationPage> {
    const store = await requireActorStore(actor, this.stores);
    const listed = await this.notifications.list(
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

  async markRead(actor: RequestActor, id: string): Promise<NotificationRecord> {
    const store = await requireActorStore(actor, this.stores);
    const notification = await this.notifications.markRead(
      store.tenantId,
      store.id,
      id,
      new Date(),
    );
    if (notification === null) {
      throw new DomainException(
        'NOTIFICATION_NOT_FOUND',
        'The notification was not found',
        404,
      );
    }
    return notification;
  }
}
