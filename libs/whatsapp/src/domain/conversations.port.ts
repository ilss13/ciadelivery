import { ConversationMode, MessageAuthor } from './conversation';
import { OrderTemplateKey } from './order-templates';
import { OutboundMessageStatus } from './outbound-messages.port';

export interface ConversationRecord {
  id: string;
  tenantId: string;
  storeId: string;
  customerId: string | null;
  contactPhone: string;
  contactName: string | null;
  mode: ConversationMode;
  linkedOrderId: string | null;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessageRecord {
  id: string;
  direction: 'IN' | 'OUT';
  author: MessageAuthor;
  body: string;
  templateKey: OrderTemplateKey | null;
  status: OutboundMessageStatus;
  createdAt: Date;
}

export interface InboundDraft {
  tenantId: string;
  storeId: string;
  contactPhone: string;
  contactName: string | null;
  body: string;
  externalId: string;
  receivedAt: Date;
}

export interface StoredInbound {
  inserted: boolean;
  conversationId: string | null;
  messageId: string | null;
  storeId: string | null;
  body: string;
  createdAt: Date | null;
}

export interface SystemNotice {
  tenantId: string;
  storeId: string;
  contactPhone: string;
  contactName: string | null;
  messageId: string;
  at: Date;
}

export interface ConversationListQuery {
  tenantId: string;
  storeId: string;
  page: number;
  pageSize: number;
}

export interface Conversations {
  acceptInbound(draft: InboundDraft): Promise<StoredInbound>;
  recordSystemNotice(notice: SystemNotice): Promise<void>;
  findInStore(
    tenantId: string,
    storeId: string,
    id: string,
  ): Promise<ConversationRecord | null>;
  list(
    query: ConversationListQuery,
  ): Promise<{ data: ConversationRecord[]; total: number }>;
  listMessages(
    tenantId: string,
    conversationId: string,
    page: number,
    pageSize: number,
  ): Promise<{ data: ConversationMessageRecord[]; total: number }>;
  recentMessages(
    tenantId: string,
    conversationId: string,
    limit: number,
  ): Promise<ConversationMessageRecord[]>;
  setMode(
    tenantId: string,
    storeId: string,
    id: string,
    mode: ConversationMode,
    at: Date,
  ): Promise<boolean>;
  touch(tenantId: string, id: string, at: Date): Promise<void>;
  close(tenantId: string, storeId: string, id: string, at: Date): Promise<void>;
}

export const CONVERSATIONS = Symbol('CONVERSATIONS');

export interface ConversationEvents {
  messageReceived(input: {
    storeId: string;
    conversationId: string;
    messageId: string;
    body: string;
    createdAt: Date;
  }): Promise<void>;
  modeChanged(input: {
    storeId: string;
    conversationId: string;
    mode: ConversationMode;
    reason: string;
  }): Promise<void>;
}

export const CONVERSATION_EVENTS = Symbol('CONVERSATION_EVENTS');

export interface TextDispatch {
  enqueue(messageId: string): Promise<void>;
}

export const TEXT_DISPATCH = Symbol('TEXT_DISPATCH');
