import { AUDIT_LOGS, AuditLogs, AuditModule } from '@ciadelivery/audit';
import { CHECKLIST, Checklist, OnboardingModule } from '@ciadelivery/onboarding';
import { OrdersModule } from '@ciadelivery/orders';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  APP_CONFIG,
  AppConfig,
  DatabaseReady,
  GEOCODING,
  GeocodingProvider,
} from '@ciadelivery/shared';
import { CURRENT_STORE, CurrentStore, StoresModule } from '@ciadelivery/stores';
import {
  TenancyCoreModule,
  UNIT_OF_WORK,
  UnitOfWork,
} from '@ciadelivery/tenancy';
import { PermissionsGuard, UsersModule } from '@ciadelivery/users';
import { AdminConversations } from './application/admin-conversations';
import { AdminWhatsApp } from './application/admin-whatsapp';
import { AutomatedConversation } from './application/automated-conversation';
import { InboundWhatsApp } from './application/inbound-whatsapp';
import {
  AI_CONFIGURATIONS,
  AI_TURNS,
  AiConfigurations,
  AiTurns,
} from './domain/ai-turns.port';
import {
  ReceiveWhatsAppWebhook,
  VerifyWhatsAppWebhook,
} from './application/receive-webhook';
import {
  CONVERSATION_ORDERS,
  ConversationOrders,
} from './domain/conversation-orders.port';
import {
  CONVERSATION_TOOLS,
  ConversationTools,
} from './domain/conversation-tools';
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
import { LLM_PROVIDER, LlmProvider } from './domain/llm-provider';
import { RedisConversationEvents } from './infrastructure/conversation-realtime';
import { HttpLlmProvider } from './infrastructure/http-llm-provider';
import { TypeOrmConversationTools } from './infrastructure/typeorm-conversation-tools';
import { TypeOrmConversationOrders } from './infrastructure/typeorm-conversation-orders';
import {
  TypeOrmAiConfigurations,
  TypeOrmAiTurns,
} from './infrastructure/typeorm-ai';
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
    OrdersModule,
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
    TypeOrmAiConfigurations,
    { provide: AI_CONFIGURATIONS, useExisting: TypeOrmAiConfigurations },
    TypeOrmAiTurns,
    { provide: AI_TURNS, useExisting: TypeOrmAiTurns },
    {
      provide: TypeOrmConversationTools,
      useFactory: (database: DatabaseReady, geocoding: GeocodingProvider) =>
        new TypeOrmConversationTools(database, geocoding),
      inject: [DatabaseReady, GEOCODING],
    },
    { provide: CONVERSATION_TOOLS, useExisting: TypeOrmConversationTools },
    TypeOrmConversationOrders,
    { provide: CONVERSATION_ORDERS, useExisting: TypeOrmConversationOrders },
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
      provide: LLM_PROVIDER,
      useFactory: (config: AppConfig): LlmProvider | null =>
        config.llmDriver === 'http'
          ? new HttpLlmProvider(config.llmApiUrl)
          : null,
      inject: [APP_CONFIG],
    },
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
      useFactory: (
        conversations: Conversations,
        events: ConversationEvents,
        automated: AutomatedConversation,
      ) => new InboundWhatsApp(conversations, events, automated),
      inject: [CONVERSATIONS, CONVERSATION_EVENTS, AutomatedConversation],
    },
    {
      provide: AutomatedConversation,
      useFactory: (
        conversations: Conversations,
        configurations: AiConfigurations,
        turns: AiTurns,
        messages: OutboundMessages,
        dispatch: TextDispatch,
        events: ConversationEvents,
        provider: LlmProvider | null,
        tools: ConversationTools,
        orders: ConversationOrders,
        config: AppConfig,
      ) =>
        new AutomatedConversation(
          conversations,
          configurations,
          turns,
          messages,
          dispatch,
          events,
          provider,
          tools,
          orders,
          { confidenceMin: config.aiConfidenceMin },
        ),
      inject: [
        CONVERSATIONS,
        AI_CONFIGURATIONS,
        AI_TURNS,
        OUTBOUND_MESSAGES,
        TEXT_DISPATCH,
        CONVERSATION_EVENTS,
        LLM_PROVIDER,
        CONVERSATION_TOOLS,
        CONVERSATION_ORDERS,
        APP_CONFIG,
      ],
    },
    {
      provide: AdminConversations,
      useFactory: (
        conversations: Conversations,
        connections: WhatsAppConnections,
        messages: OutboundMessages,
        dispatch: TextDispatch,
        stores: CurrentStore,
        ai: AiConfigurations,
        events: ConversationEvents,
      ) =>
        new AdminConversations(
          conversations,
          connections,
          messages,
          dispatch,
          stores,
          ai,
          events,
        ),
      inject: [
        CONVERSATIONS,
        WHATSAPP_CONNECTIONS,
        OUTBOUND_MESSAGES,
        TEXT_DISPATCH,
        CURRENT_STORE,
        AI_CONFIGURATIONS,
        CONVERSATION_EVENTS,
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
