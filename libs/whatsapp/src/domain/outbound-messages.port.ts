import { MessageAuthor } from './conversation';
import { OrderTemplateKey } from './order-templates';

export const OUTBOUND_MESSAGE_STATUSES = [
  'QUEUED',
  'SENT',
  'FAILED',
  'SKIPPED',
] as const;

export type OutboundMessageStatus = (typeof OUTBOUND_MESSAGE_STATUSES)[number];

export interface OutboundMessageRecord {
  id: string;
  tenantId: string;
  conversationId: string | null;
  direction: 'IN' | 'OUT';
  author: MessageAuthor;
  toPhone: string;
  templateKey: OrderTemplateKey | null;
  body: string;
  status: OutboundMessageStatus;
  providerMessageId: string | null;
  eventId: string | null;
  externalId: string | null;
  lastError: string | null;
  createdAt: Date;
}

export interface MessageFailure {
  toPhone: string;
  lastError: string;
}

export interface SystemSendRecord {
  id: string;
  templateKey: OrderTemplateKey | null;
  status: OutboundMessageStatus;
  createdAt: Date;
  lastError: string | null;
}

export interface OutboundMessages {
  findByEventId(eventId: string): Promise<OutboundMessageRecord | null>;
  findById(id: string): Promise<OutboundMessageRecord | null>;
  insert(message: OutboundMessageRecord): Promise<'inserted' | 'duplicate'>;
  remove(id: string, tenantId: string): Promise<void>;
  markSent(
    id: string,
    tenantId: string,
    providerMessageId: string,
  ): Promise<void>;
  markFailed(id: string, tenantId: string, lastError: string): Promise<void>;
  markSkipped(id: string, tenantId: string, reason: string): Promise<void>;
  latestFailure(
    tenantId: string,
    templateKey: OrderTemplateKey,
  ): Promise<MessageFailure | null>;
  listRecentSystem(tenantId: string, limit: number): Promise<SystemSendRecord[]>;
}

export const OUTBOUND_MESSAGES = Symbol('OUTBOUND_MESSAGES');
