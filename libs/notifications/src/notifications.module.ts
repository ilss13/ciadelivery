import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoresModule, CURRENT_STORE, CurrentStore } from '@ciadelivery/stores';
import { TenancyCoreModule } from '@ciadelivery/tenancy';
import { PermissionsGuard } from '@ciadelivery/users';
import { AdminNotifications } from './application/admin-notifications';
import { NOTIFICATIONS, NotificationStore, TRACKING_ORDERS } from './domain/notification';
import { CONVERSATION_ROOMS } from './domain/realtime';
import { TypeOrmConversationRooms } from './infrastructure/conversation-rooms';
import { NotificationEntity } from './infrastructure/notification.entity';
import { RedisRealtimeSubscriber } from './infrastructure/redis-realtime';
import { TypeOrmTrackingOrders } from './infrastructure/tracking-orders';
import { TypeOrmNotifications } from './infrastructure/typeorm-notifications';
import { AdminNotificationsController } from './presentation/admin-notifications.controller';
import { RealtimeGateway } from './presentation/realtime.gateway';

@Module({
  imports: [
    TenancyCoreModule,
    StoresModule,
    TypeOrmModule.forFeature([NotificationEntity]),
  ],
  controllers: [AdminNotificationsController],
  providers: [
    PermissionsGuard,
    TypeOrmNotifications,
    { provide: NOTIFICATIONS, useExisting: TypeOrmNotifications },
    TypeOrmTrackingOrders,
    { provide: TRACKING_ORDERS, useExisting: TypeOrmTrackingOrders },
    RedisRealtimeSubscriber,
    TypeOrmConversationRooms,
    { provide: CONVERSATION_ROOMS, useExisting: TypeOrmConversationRooms },
    RealtimeGateway,
    {
      provide: AdminNotifications,
      useFactory: (notifications: NotificationStore, stores: CurrentStore) =>
        new AdminNotifications(notifications, stores),
      inject: [NOTIFICATIONS, CURRENT_STORE],
    },
  ],
})
export class NotificationsModule {}
