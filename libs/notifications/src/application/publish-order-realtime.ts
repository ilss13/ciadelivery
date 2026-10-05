import {
  NotificationRecord,
  NotificationStore,
  RealtimePublisher,
} from '../domain/notification';
import { orderRealtimeDispatch, RealtimeEnvelope } from '../domain/realtime';

export class PublishOrderRealtime {
  constructor(
    private readonly notifications: NotificationStore,
    private readonly realtime: RealtimePublisher,
  ) {}

  async execute(event: {
    id: string;
    tenantId: string;
    type: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const dispatch = orderRealtimeDispatch(event);
    if (dispatch === null) {
      return;
    }

    if (event.type === 'order.created') {
      const notification = await this.notifications.recordOrderCreated({
        eventId: event.id,
        tenantId: event.tenantId,
        storeId: dispatch.storeId,
        orderId: dispatch.payload.orderId,
        orderNumber: dispatch.payload.orderNumber,
        createdAt: new Date(dispatch.payload.occurredAt),
      });
      await this.realtime.publish(notificationEnvelope(notification));
    }

    await this.realtime.publish({
      event: dispatch.event,
      rooms: dispatch.rooms,
      payload: {
        orderId: dispatch.payload.orderId,
        status: dispatch.payload.status,
        orderNumber: dispatch.payload.orderNumber,
        occurredAt: dispatch.payload.occurredAt,
      },
    });
  }
}

function notificationEnvelope(notification: NotificationRecord): RealtimeEnvelope {
  return {
    event: 'notification.created',
    rooms: [`store:${notification.storeId}`],
    payload: {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      orderId: notification.orderId ?? '',
      createdAt: notification.createdAt.toISOString(),
    },
  };
}
