import { JsonLogger } from '@ciadelivery/shared';
import { WhatsAppConnectionRecord } from '../domain/connections.port';
import {
  canonicalContactPhone,
  contactLabel,
  inboundBody,
} from '../domain/conversation';
import {
  ConversationEvents,
  Conversations,
} from '../domain/conversations.port';
import { ParsedWebhookMessage } from '../domain/whatsapp-provider';
import { AutomatedConversation } from './automated-conversation';

export class InboundWhatsApp {
  private readonly logger = new JsonLogger();

  constructor(
    private readonly conversations: Conversations,
    private readonly events: ConversationEvents,
    private readonly automated: AutomatedConversation,
  ) {}

  async execute(
    connection: WhatsAppConnectionRecord,
    message: ParsedWebhookMessage,
    receivedAt: Date,
  ): Promise<void> {
    const contactPhone = canonicalContactPhone(message.from);
    if (contactPhone === null) {
      return;
    }
    const stored = await this.conversations.acceptInbound({
      tenantId: connection.tenantId,
      storeId: connection.storeId,
      contactPhone,
      contactName: contactLabel(message.contactName),
      body: inboundBody(message.body),
      externalId: message.externalId,
      receivedAt,
    });
    if (
      !stored.inserted ||
      stored.conversationId === null ||
      stored.messageId === null ||
      stored.storeId === null ||
      stored.createdAt === null
    ) {
      return;
    }
    await this.events.messageReceived({
      storeId: stored.storeId,
      conversationId: stored.conversationId,
      messageId: stored.messageId,
      body: stored.body,
      createdAt: stored.createdAt,
    });
    try {
      await this.automated.execute({
        tenantId: connection.tenantId,
        storeId: stored.storeId,
        conversationId: stored.conversationId,
        body: stored.body,
        receivedAt: stored.createdAt,
      });
    } catch {
      this.logger.error(
        'Automated conversation processing failed',
        undefined,
        'InboundWhatsApp',
      );
    }
    this.logger.log(
      `WhatsApp inbound stored ${stored.conversationId}`,
      'InboundWhatsApp',
    );
  }
}
