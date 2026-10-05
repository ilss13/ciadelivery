import { randomUUID } from 'node:crypto';
import { DomainException, JsonLogger } from '@ciadelivery/shared';
import { CurrentStore } from '@ciadelivery/stores';
import { RequestActor } from '@ciadelivery/users';
import { maskPhone } from '../domain/order-templates';
import { WhatsAppConnections } from '../domain/connections.port';
import { ConversationMode, MessageAuthor } from '../domain/conversation';
import {
  ConversationRecord,
  Conversations,
  TextDispatch,
} from '../domain/conversations.port';
import { OrderTemplateKey } from '../domain/order-templates';
import { OutboundMessages } from '../domain/outbound-messages.port';

export interface ConversationListItem {
  id: string;
  maskedPhone: string;
  contactName: string | null;
  mode: ConversationMode;
  linkedOrderId: string | null;
  lastMessageAt: string;
}

export interface ConversationMessageItem {
  id: string;
  direction: 'IN' | 'OUT';
  author: MessageAuthor;
  body: string;
  templateKey: OrderTemplateKey | null;
  status: string;
  createdAt: string;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ConversationThread {
  conversation: {
    id: string;
    contactPhone: string;
    contactName: string | null;
    mode: ConversationMode;
    linkedOrderId: string | null;
    lastMessageAt: string;
  };
  data: ConversationMessageItem[];
  meta: PageMeta;
}

export class AdminConversations {
  private readonly logger = new JsonLogger();

  constructor(
    private readonly conversations: Conversations,
    private readonly connections: WhatsAppConnections,
    private readonly outbound: OutboundMessages,
    private readonly dispatch: TextDispatch,
    private readonly stores: CurrentStore,
  ) {}

  async list(
    actor: RequestActor,
    page: number,
    pageSize: number,
  ): Promise<{ data: ConversationListItem[]; meta: PageMeta }> {
    const store = await this.requireStore(actor);
    const result = await this.conversations.list({
      tenantId: store.tenantId,
      storeId: store.id,
      page,
      pageSize,
    });
    return {
      data: result.data.map((conversation) => ({
        id: conversation.id,
        maskedPhone: maskPhone(conversation.contactPhone),
        contactName: conversation.contactName,
        mode: conversation.mode,
        linkedOrderId: conversation.linkedOrderId,
        lastMessageAt: conversation.lastMessageAt.toISOString(),
      })),
      meta: toMeta(page, pageSize, result.total),
    };
  }

  async listMessages(
    actor: RequestActor,
    conversationId: string,
    page: number,
    pageSize: number,
  ): Promise<ConversationThread> {
    const store = await this.requireStore(actor);
    const conversation = await this.conversations.findInStore(
      store.tenantId,
      store.id,
      conversationId,
    );
    if (conversation === null) {
      throw notFound();
    }
    const result = await this.conversations.listMessages(
      store.tenantId,
      conversation.id,
      page,
      pageSize,
    );
    return {
      conversation: toDetail(conversation),
      data: result.data.map((message) => ({
        id: message.id,
        direction: message.direction,
        author: message.author,
        body: message.body,
        templateKey: message.templateKey,
        status: message.status,
        createdAt: message.createdAt.toISOString(),
      })),
      meta: toMeta(page, pageSize, result.total),
    };
  }

  async reply(
    actor: RequestActor,
    conversationId: string,
    body: string,
  ): Promise<ConversationMessageItem> {
    const store = await this.requireStore(actor);
    const conversation = await this.conversations.findInStore(
      store.tenantId,
      store.id,
      conversationId,
    );
    if (conversation === null) {
      throw notFound();
    }
    if (conversation.mode === 'CLOSED') {
      throw new DomainException(
        'CONVERSATION_CLOSED',
        'The conversation is closed',
        409,
      );
    }
    const connection = await this.connections.findConnectedForTenant(store.tenantId);
    if (
      connection === null ||
      connection.storeId !== store.id ||
      connection.encryptedCredentials === null
    ) {
      throw new DomainException(
        'WHATSAPP_NOT_CONNECTED',
        'The WhatsApp number is not connected',
        409,
      );
    }

    const createdAt = new Date();
    const message = {
      id: randomUUID(),
      tenantId: store.tenantId,
      conversationId: conversation.id,
      direction: 'OUT' as const,
      author: 'USER' as const,
      toPhone: conversation.contactPhone,
      templateKey: null,
      body,
      status: 'QUEUED' as const,
      providerMessageId: null,
      eventId: null,
      externalId: null,
      lastError: null,
      createdAt,
    };
    await this.outbound.insert(message);
    try {
      await this.dispatch.enqueue(message.id);
    } catch (error) {
      await this.outbound.remove(message.id, store.tenantId);
      this.logger.error(
        `WhatsApp reply was not queued ${conversation.id}`,
        undefined,
        'AdminConversations',
      );
      throw error;
    }
    await this.conversations.touch(store.tenantId, conversation.id, createdAt);
    return {
      id: message.id,
      direction: 'OUT',
      author: 'USER',
      body,
      templateKey: null,
      status: 'QUEUED',
      createdAt: createdAt.toISOString(),
    };
  }

  async close(
    actor: RequestActor,
    conversationId: string,
  ): Promise<ConversationListItem> {
    const store = await this.requireStore(actor);
    const conversation = await this.conversations.findInStore(
      store.tenantId,
      store.id,
      conversationId,
    );
    if (conversation === null) {
      throw notFound();
    }
    const at = new Date();
    if (conversation.mode !== 'CLOSED') {
      await this.conversations.close(store.tenantId, store.id, conversation.id, at);
      conversation.mode = 'CLOSED';
      conversation.updatedAt = at;
    }
    return {
      id: conversation.id,
      maskedPhone: maskPhone(conversation.contactPhone),
      contactName: conversation.contactName,
      mode: conversation.mode,
      linkedOrderId: conversation.linkedOrderId,
      lastMessageAt: conversation.lastMessageAt.toISOString(),
    };
  }

  private async requireStore(actor: RequestActor) {
    if (actor.tenantId === null || actor.storeId === null) {
      throw new DomainException('STORE_NOT_FOUND', 'The store was not found', 404);
    }
    const store = await this.stores.findForCurrentTenant();
    if (
      store === null ||
      store.tenantId !== actor.tenantId ||
      store.id !== actor.storeId
    ) {
      throw new DomainException('STORE_NOT_FOUND', 'The store was not found', 404);
    }
    return store;
  }
}

function toDetail(conversation: ConversationRecord): ConversationThread['conversation'] {
  return {
    id: conversation.id,
    contactPhone: conversation.contactPhone,
    contactName: conversation.contactName,
    mode: conversation.mode,
    linkedOrderId: conversation.linkedOrderId,
    lastMessageAt: conversation.lastMessageAt.toISOString(),
  };
}

function toMeta(page: number, pageSize: number, total: number): PageMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

function notFound(): DomainException {
  return new DomainException(
    'CONVERSATION_NOT_FOUND',
    'The conversation was not found',
    404,
  );
}
