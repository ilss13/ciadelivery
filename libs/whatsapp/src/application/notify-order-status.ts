import { randomUUID } from 'node:crypto';
import { DomainException, JsonLogger } from '@ciadelivery/shared';
import { WhatsAppConnectionRecord, WhatsAppConnections } from '../domain/connections.port';
import {
  decodeCredentialsKey,
  decryptCredentials,
} from '../domain/credentials-cipher';
import { MessageTemplateRecord, MessageTemplates } from '../domain/message-templates.port';
import { OrderNotice, OrderNotices, StatusEvents } from '../domain/order-notices.port';
import {
  OrderTemplateKey,
  formatOrderTotal,
  orderStatusMessage,
  statusLabel,
  templateKeyForEvent,
  whatsAppRecipient,
} from '../domain/order-templates';
import { Conversations } from '../domain/conversations.port';
import {
  OutboundMessageRecord,
  OutboundMessageStatus,
  OutboundMessages,
} from '../domain/outbound-messages.port';
import { whatsAppSendLog, WhatsAppSendOutcome } from '../domain/send-log';
import { recordWhatsAppMetric } from './whatsapp-metrics';
import { TemplateNotApprovedError } from '../domain/template-approval';
import { WhatsAppProvider } from '../domain/whatsapp-provider';

export const MAX_WHATSAPP_SEND_ATTEMPTS = 5;

const TERMINAL: ReadonlySet<OutboundMessageStatus> = new Set([
  'SENT',
  'FAILED',
  'SKIPPED',
]);

export interface NotifyOrderOptions {
  encryptionKey: string;
  allowSessionMessages: boolean;
  driver: 'log' | 'meta';
}

export class NotifyOrderStatus {
  private readonly logger = new JsonLogger();

  constructor(
    private readonly events: StatusEvents,
    private readonly orders: OrderNotices,
    private readonly connections: WhatsAppConnections,
    private readonly templates: MessageTemplates,
    private readonly messages: OutboundMessages,
    private readonly conversations: Conversations,
    private readonly whatsapp: WhatsAppProvider,
    private readonly options: NotifyOrderOptions,
  ) {}

  async execute(eventId: string, attempt: number): Promise<void> {
    const event = await this.events.find(eventId);
    if (event === null) {
      return;
    }
    const templateKey = templateKeyForEvent(event.type);
    if (templateKey === undefined) {
      return;
    }

    const existing = await this.messages.findByEventId(event.id);
    if (existing !== null && existing.tenantId !== event.tenantId) {
      return;
    }
    if (existing !== null && TERMINAL.has(existing.status)) {
      return;
    }

    const order = await this.orders.find(event.tenantId, event.orderId);
    if (order === null || order.tenantId !== event.tenantId) {
      return;
    }
    if (order.source === 'TEST') {
      return;
    }
    if (order.source === 'WHATSAPP' && event.type === 'order.created') {
      return;
    }

    const connection = await this.connections.findConnectedForTenant(event.tenantId);
    if (
      connection === null ||
      connection.tenantId !== event.tenantId ||
      connection.encryptedCredentials === null
    ) {
      await this.skip(existing, event.tenantId, event.id, order, templateKey, 'NO_CONNECTION');
      return;
    }

    const template = await this.templates.find(event.tenantId, templateKey);
    if (template === null || !template.enabled || template.tenantId !== event.tenantId) {
      await this.skip(
        existing,
        event.tenantId,
        event.id,
        order,
        templateKey,
        'TEMPLATE_DISABLED',
      );
      return;
    }

    const body = render(order, templateKey);
    const toPhone = whatsAppRecipient(order.customerPhone);
    const queued = await this.ensure(existing, {
      id: randomUUID(),
      tenantId: event.tenantId,
      conversationId: null,
      direction: 'OUT',
      author: 'SYSTEM',
      toPhone,
      templateKey,
      body,
      status: 'QUEUED',
      providerMessageId: null,
      eventId: event.id,
      externalId: null,
      lastError: null,
      createdAt: new Date(),
    });
    if (queued === null) {
      return;
    }
    await this.conversations.recordSystemNotice({
      tenantId: event.tenantId,
      storeId: order.storeId,
      contactPhone: toPhone,
      contactName: order.customerName,
      messageId: queued.id,
      at: queued.createdAt,
    });

    try {
      const sent = await this.send(connection, template, order, toPhone, body);
      await this.messages.markSent(queued.id, event.tenantId, sent.id);
      this.record(queued, attempt, 'sent');
    } catch (error) {
      if (attempt >= MAX_WHATSAPP_SEND_ATTEMPTS) {
        await this.messages.markFailed(
          queued.id,
          event.tenantId,
          publicError(error),
        );
        this.record(queued, attempt, 'failed');
        return;
      }
      this.record(queued, attempt, 'retry');
      throw error;
    }
  }

  private async send(
    connection: WhatsAppConnectionRecord,
    template: MessageTemplateRecord,
    order: OrderNotice,
    toPhone: string,
    body: string,
  ): Promise<{ id: string }> {
    const accessToken = this.token(connection);
    try {
      return await this.whatsapp.sendTemplate({
        phoneNumberId: connection.phoneNumberId,
        accessToken,
        to: toPhone,
        templateName: template.metaTemplateName,
        languageCode: template.language,
        bodyParameters: [
          order.customerName.trim(),
          String(order.orderNumber),
          order.storeName.trim(),
          formatOrderTotal(order.totalCents),
          statusLabel(order.status),
        ],
      });
    } catch (error) {
      if (
        error instanceof TemplateNotApprovedError &&
        this.options.allowSessionMessages &&
        this.options.driver === 'meta'
      ) {
        return this.whatsapp.sendText({
          phoneNumberId: connection.phoneNumberId,
          accessToken,
          to: toPhone,
          body,
        });
      }
      throw error;
    }
  }

  private token(connection: WhatsAppConnectionRecord): string {
    const key = decodeCredentialsKey(this.options.encryptionKey);
    if (key === null || connection.encryptedCredentials === null) {
      throw new Error('WHATSAPP_ENCRYPTION_UNAVAILABLE');
    }
    return decryptCredentials(connection.encryptedCredentials, key);
  }

  private async skip(
    existing: OutboundMessageRecord | null,
    tenantId: string,
    eventId: string,
    order: OrderNotice,
    templateKey: OrderTemplateKey,
    reason: string,
  ): Promise<void> {
    if (existing !== null) {
      if (!TERMINAL.has(existing.status)) {
        await this.messages.markSkipped(existing.id, tenantId, reason);
        this.record(existing, 1, 'skipped');
      }
      return;
    }
    const skipped: OutboundMessageRecord = {
      id: randomUUID(),
      tenantId,
      conversationId: null,
      direction: 'OUT',
      author: 'SYSTEM',
      toPhone: whatsAppRecipient(order.customerPhone),
      templateKey,
      body: '',
      status: 'SKIPPED',
      providerMessageId: null,
      eventId,
      externalId: null,
      lastError: reason,
      createdAt: new Date(),
    };
    const inserted = await this.messages.insert(skipped);
    if (inserted === 'duplicate') {
      return;
    }
    this.record(skipped, 1, 'skipped');
  }

  private record(
    message: OutboundMessageRecord,
    attempt: number,
    outcome: WhatsAppSendOutcome,
  ): void {
    this.logger.log(
      whatsAppSendLog({
        tenantId: message.tenantId,
        messageId: message.id,
        templateKey: message.templateKey,
        attempt,
        outcome,
        phone: message.toPhone,
        body: message.body,
      }),
      'NotifyOrderStatus',
    );
    recordWhatsAppMetric(outcome);
  }

  private async ensure(
    existing: OutboundMessageRecord | null,
    draft: OutboundMessageRecord,
  ): Promise<OutboundMessageRecord | null> {
    if (existing !== null) {
      return TERMINAL.has(existing.status) ? null : existing;
    }
    const inserted = await this.messages.insert(draft);
    if (inserted === 'inserted') {
      return draft;
    }
    if (draft.eventId === null) {
      return null;
    }
    const again = await this.messages.findByEventId(draft.eventId);
    if (again === null || again.tenantId !== draft.tenantId || TERMINAL.has(again.status)) {
      return null;
    }
    return again;
  }
}

function render(order: OrderNotice, templateKey: OrderTemplateKey): string {
  const body = orderStatusMessage({
    templateKey,
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    storeName: order.storeName,
    totalCents: order.totalCents,
    status: order.status,
  });
  if (order.hasTrackingToken && body.includes('/pedido/')) {
    throw new Error('The tracking link must stay out of the WhatsApp body');
  }
  return body;
}

function publicError(error: unknown): string {
  if (error instanceof TemplateNotApprovedError) {
    return error.code;
  }
  if (error instanceof DomainException) {
    return error.code;
  }
  const message =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : 'WHATSAPP_SEND_FAILED';
  return message.replace(/\s+/g, ' ').trim().slice(0, 500);
}
