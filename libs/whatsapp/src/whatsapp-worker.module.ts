import { Injectable, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_CONFIG, AppConfig } from '@ciadelivery/shared';
import {
  OutboxHandlerRegistry,
  OutboxHandlerRegistryModule,
} from '@ciadelivery/orders/worker';
import { NotifyOrderStatus } from './application/notify-order-status';
import { SendQueuedText } from './application/send-queued-text';
import { WHATSAPP_CONNECTIONS, WhatsAppConnections } from './domain/connections.port';
import { CONVERSATIONS, Conversations } from './domain/conversations.port';
import { MESSAGE_TEMPLATES, MessageTemplates } from './domain/message-templates.port';
import { ORDER_NOTICES, OrderNotices, STATUS_EVENTS, StatusEvents } from './domain/order-notices.port';
import { OUTBOUND_MESSAGES, OutboundMessages } from './domain/outbound-messages.port';
import { WHATSAPP, WhatsAppProvider } from './domain/whatsapp-provider';
import { OrderStatusOutboxHandler } from './infrastructure/order-status-outbox-handler';
import { TypeOrmConversations } from './infrastructure/typeorm-conversations';
import { TypeOrmMessageTemplates } from './infrastructure/typeorm-message-templates';
import { TypeOrmOrderNotices, TypeOrmStatusEvents } from './infrastructure/typeorm-order-notices';
import { TypeOrmOutboundMessages } from './infrastructure/typeorm-outbound-messages';
import { TypeOrmWhatsAppConnections } from './infrastructure/typeorm-connections';
import {
  LoggingWhatsAppProvider,
  MetaCloudWhatsAppProvider,
} from './infrastructure/whatsapp-providers';
import {
  ConversationEntity,
  MessageTemplateEntity,
  WhatsAppConnectionEntity,
  WhatsAppMessageEntity,
} from './infrastructure/whatsapp.entities';
import { WhatsAppStatusQueue } from './infrastructure/whatsapp-status-queue';

@Injectable()
class RegisterOrderStatusHandler {
  constructor(
    registry: OutboxHandlerRegistry,
    handler: OrderStatusOutboxHandler,
  ) {
    registry.add(handler);
  }
}

@Module({
  imports: [
    OutboxHandlerRegistryModule,
    TypeOrmModule.forFeature([
      WhatsAppConnectionEntity,
      MessageTemplateEntity,
      WhatsAppMessageEntity,
      ConversationEntity,
    ]),
  ],
  providers: [
    TypeOrmWhatsAppConnections,
    { provide: WHATSAPP_CONNECTIONS, useExisting: TypeOrmWhatsAppConnections },
    TypeOrmMessageTemplates,
    { provide: MESSAGE_TEMPLATES, useExisting: TypeOrmMessageTemplates },
    TypeOrmOutboundMessages,
    { provide: OUTBOUND_MESSAGES, useExisting: TypeOrmOutboundMessages },
    TypeOrmConversations,
    { provide: CONVERSATIONS, useExisting: TypeOrmConversations },
    TypeOrmOrderNotices,
    { provide: ORDER_NOTICES, useExisting: TypeOrmOrderNotices },
    TypeOrmStatusEvents,
    { provide: STATUS_EVENTS, useExisting: TypeOrmStatusEvents },
    {
      provide: WHATSAPP,
      useFactory: (config: AppConfig): WhatsAppProvider =>
        config.whatsappDriver === 'meta'
          ? new MetaCloudWhatsAppProvider(config.metaGraphVersion, config.metaAppSecret)
          : new LoggingWhatsAppProvider(config.metaAppSecret),
      inject: [APP_CONFIG],
    },
    {
      provide: NotifyOrderStatus,
      useFactory: (
        events: StatusEvents,
        orders: OrderNotices,
        connections: WhatsAppConnections,
        templates: MessageTemplates,
        messages: OutboundMessages,
        conversations: Conversations,
        whatsapp: WhatsAppProvider,
        config: AppConfig,
      ) =>
        new NotifyOrderStatus(
          events,
          orders,
          connections,
          templates,
          messages,
          conversations,
          whatsapp,
          {
            encryptionKey: config.credentialsEncryptionKey,
            allowSessionMessages: config.whatsappAllowSessionMessages,
            driver: config.whatsappDriver,
          },
        ),
      inject: [
        STATUS_EVENTS,
        ORDER_NOTICES,
        WHATSAPP_CONNECTIONS,
        MESSAGE_TEMPLATES,
        OUTBOUND_MESSAGES,
        CONVERSATIONS,
        WHATSAPP,
        APP_CONFIG,
      ],
    },
    {
      provide: SendQueuedText,
      useFactory: (
        messages: OutboundMessages,
        connections: WhatsAppConnections,
        whatsapp: WhatsAppProvider,
        config: AppConfig,
      ) =>
        new SendQueuedText(
          messages,
          connections,
          whatsapp,
          config.credentialsEncryptionKey,
        ),
      inject: [OUTBOUND_MESSAGES, WHATSAPP_CONNECTIONS, WHATSAPP, APP_CONFIG],
    },
    WhatsAppStatusQueue,
    OrderStatusOutboxHandler,
    RegisterOrderStatusHandler,
  ],
  exports: [NotifyOrderStatus, WHATSAPP],
})
export class WhatsAppWorkerModule {}
