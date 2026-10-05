import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OUTBOX_EXTRA_HANDLERS, OutboxHandler } from '@ciadelivery/orders';
import { PublishOrderRealtime } from './application/publish-order-realtime';
import {
  NOTIFICATIONS,
  NotificationStore,
  REALTIME_PUBLISHER,
  RealtimePublisher,
} from './domain/notification';
import { NotificationEntity } from './infrastructure/notification.entity';
import { RealtimeOutboxHandler } from './infrastructure/realtime-outbox-handler';
import { RedisRealtimePublisher } from './infrastructure/redis-realtime';
import { TypeOrmNotifications } from './infrastructure/typeorm-notifications';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([NotificationEntity])],
  providers: [
    TypeOrmNotifications,
    { provide: NOTIFICATIONS, useExisting: TypeOrmNotifications },
    RedisRealtimePublisher,
    { provide: REALTIME_PUBLISHER, useExisting: RedisRealtimePublisher },
    {
      provide: PublishOrderRealtime,
      useFactory: (notifications: NotificationStore, realtime: RealtimePublisher) =>
        new PublishOrderRealtime(notifications, realtime),
      inject: [NOTIFICATIONS, REALTIME_PUBLISHER],
    },
    RealtimeOutboxHandler,
    {
      provide: OUTBOX_EXTRA_HANDLERS,
      useFactory: (handler: RealtimeOutboxHandler): readonly OutboxHandler[] => [handler],
      inject: [RealtimeOutboxHandler],
    },
  ],
  exports: [OUTBOX_EXTRA_HANDLERS],
})
export class NotificationsWorkerModule {}
