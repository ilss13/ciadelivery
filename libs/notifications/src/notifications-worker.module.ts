import { Injectable, Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  OutboxHandlerRegistry,
  OutboxHandlerRegistryModule,
} from '@ciadelivery/orders/worker';
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

@Injectable()
class RegisterRealtimeOutboxHandler {
  constructor(
    registry: OutboxHandlerRegistry,
    handler: RealtimeOutboxHandler,
  ) {
    registry.add(handler);
  }
}

@Global()
@Module({
  imports: [
    OutboxHandlerRegistryModule,
    TypeOrmModule.forFeature([NotificationEntity]),
  ],
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
    RegisterRealtimeOutboxHandler,
  ],
})
export class NotificationsWorkerModule {}
