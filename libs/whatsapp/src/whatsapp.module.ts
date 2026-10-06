import { AUDIT_LOGS, AuditLogs, AuditModule } from '@ciadelivery/audit';
import { CHECKLIST, Checklist, OnboardingModule } from '@ciadelivery/onboarding';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_CONFIG, AppConfig } from '@ciadelivery/shared';
import { CURRENT_STORE, CurrentStore, StoresModule } from '@ciadelivery/stores';
import {
  TenancyCoreModule,
  UNIT_OF_WORK,
  UnitOfWork,
} from '@ciadelivery/tenancy';
import { PermissionsGuard, UsersModule } from '@ciadelivery/users';
import { AdminConversations } from './application/admin-conversations';
import { AdminWhatsApp } from './application/admin-whatsapp';
import { InboundWhatsApp } from './application/inbound-whatsapp';
import {
  ReceiveWhatsAppWebhook,
  VerifyWhatsAppWebhook,
} from './application/receive-webhook';
import {
  WHATSAPP_CONNECTIONS,
  WhatsAppConnections,
} from './domain/connections.port';
import {
  CONVERSATION_EVENTS,
  CONVERSATIONS,
  ConversationEvents,
  Conversations,
  TEXT_DISPATCH,
  TextDispatch,
} from './domain/conversations.port';
import {
  MESSAGE_TEMPLATES,
  MessageTemplates,
} from './domain/message-templates.port';
import {
  OUTBOUND_MESSAGES,
  OutboundMessages,
} from './domain/outbound-messages.port';
import {
  WHATSAPP_WEBHOOK_EVENTS,
  WhatsAppWebhookEvents,
} from './domain/webhook-events.port';
import {
  WHATSAPP,
  WHATSAPP_PHONE_CHECK,
  WhatsAppPhoneCheck,
  WhatsAppProvider,
} from './domain/whatsapp-provider';
import { RedisConversationEvents } from './infrastructure/conversation-realtime';
import { TypeOrmConversations } from './infrastructure/typeorm-conversations';
import { TypeOrmMessageTemplates } from './infrastructure/typeorm-message-templates';
import { TypeOrmOutboundMessages } from './infrastructure/typeorm-outbound-messages';
import { TypeOrmWhatsAppConnections } from './infrastructure/typeorm-connections';
import { TypeOrmWhatsAppWebhookEvents } from './infrastructure/typeorm-webhook-events';
import {
  LoggingWhatsAppProvider,
  MetaCloudWhatsAppProvider,
} from './infrastructure/whatsapp-providers';
import { WhatsAppTextQueue } from './infrastructure/whatsapp-text-queue';
import {
  ConversationEntity,
  MessageTemplateEntity,
  WhatsAppConnectionEntity,
  WhatsAppMessageEntity,
  WhatsAppWebhookEventEntity,
} from './infrastructure/whatsapp.entities';
import { AdminWhatsAppController } from './presentation/admin-whatsapp.controller';
import { WhatsAppWebhookController } from './presentation/webhook-whatsapp.controller';

@Module({
  imports: [
    TenancyCoreModule,
    AuditModule,
    OnboardingModule,
    StoresModule,
    UsersModule,
    TypeOrmModule.forFeature([
      WhatsAppConnectionEntity,
      WhatsAppWebhookEventEntity,
      MessageTemplateEntity,
      WhatsAppMessageEntity,
      ConversationEntity,
    ]),
  ],
  controllers: [AdminWhatsAppController, WhatsAppWebhookController],
  providers: [
    PermissionsGuard,
    TypeOrmWhatsAppConnections,
    { provide: WHATSAPP_CONNECTIONS, useExisting: TypeOrmWhatsAppConnections },
    TypeOrmMessageTemplates,
    { provide: MESSAGE_TEMPLATES, useExisting: TypeOrmMessageTemplates },
    TypeOrmOutboundMessages,
    { provide: OUTBOUND_MESSAGES, useExisting: TypeOrmOutboundMessages },
    TypeOrmConversations,
    { provide: CONVERSATIONS, useExisting: TypeOrmConversations },
    RedisConversationEvents,
    { provide: CONVERSATION_EVENTS, useExisting: RedisConversationEvents },
    WhatsAppTextQueue,
    { provide: TEXT_DISPATCH, useExisting: WhatsAppTextQueue },
    TypeOrmWhatsAppWebhookEvents,
    {
      provide: WHATSAPP_WEBHOOK_EVENTS,
      useExisting: TypeOrmWhatsAppWebhookEvents,
    },
    {
      provide: WHATSAPP,
      useFactory: (config: AppConfig): WhatsAppProvider =>
        createProvider(config),
      inject: [APP_CONFIG],
    },
    { provide: WHATSAPP_PHONE_CHECK, useExisting: WHATSAPP },
    {
      provide: AdminWhatsApp,
      useFactory: (
        connections: WhatsAppConnections,
        templates: MessageTemplates,
        messages: OutboundMessages,
        stores: CurrentStore,
        phoneCheck: WhatsAppPhoneCheck,
        config: AppConfig,
        unitOfWork: UnitOfWork,
        audit: AuditLogs,
        checklist: Checklist,
      ) =>
        new AdminWhatsApp(
          connections,
          templates,
          messages,
          stores,
          phoneCheck,
          config.credentialsEncryptionKey,
          unitOfWork,
          audit,
          checklist,
        ),
      inject: [
        WHATSAPP_CONNECTIONS,
        MESSAGE_TEMPLATES,
        OUTBOUND_MESSAGES,
        CURRENT_STORE,
        WHATSAPP_PHONE_CHECK,
        APP_CONFIG,
        UNIT_OF_WORK,
        AUDIT_LOGS,
        CHECKLIST,
      ],
    },
    {
      provide: VerifyWhatsAppWebhook,
      useFactory: (config: AppConfig) =>
        new VerifyWhatsAppWebhook(config.metaWebhookVerifyToken),
      inject: [APP_CONFIG],
    },
    {
      provide: ReceiveWhatsAppWebhook,
      useFactory: (
        provider: WhatsAppProvider,
        connections: WhatsAppConnections,
        events: WhatsAppWebhookEvents,
        inbound: InboundWhatsApp,
      ) => new ReceiveWhatsAppWebhook(provider, connections, events, inbound),
      inject: [WHATSAPP, WHATSAPP_CONNECTIONS, WHATSAPP_WEBHOOK_EVENTS, InboundWhatsApp],
    },
    {
      provide: InboundWhatsApp,
      useFactory: (conversations: Conversations, events: ConversationEvents) =>
        new InboundWhatsApp(conversations, events),
      inject: [CONVERSATIONS, CONVERSATION_EVENTS],
    },
    {
      provide: AdminConversations,
      useFactory: (
        conversations: Conversations,
        connections: WhatsAppConnections,
        messages: OutboundMessages,
        dispatch: TextDispatch,
        stores: CurrentStore,
      ) =>
        new AdminConversations(
          conversations,
          connections,
          messages,
          dispatch,
          stores,
        ),
      inject: [
        CONVERSATIONS,
        WHATSAPP_CONNECTIONS,
        OUTBOUND_MESSAGES,
        TEXT_DISPATCH,
        CURRENT_STORE,
      ],
    },
  ],
  exports: [WHATSAPP, WHATSAPP_CONNECTIONS],
})
export class WhatsAppModule {}

function createProvider(
  config: AppConfig,
): WhatsAppProvider & WhatsAppPhoneCheck {
  if (config.whatsappDriver === 'meta') {
    return new MetaCloudWhatsAppProvider(
      config.metaGraphVersion,
      config.metaAppSecret,
    );
  }
  return new LoggingWhatsAppProvider(config.metaAppSecret);
}
