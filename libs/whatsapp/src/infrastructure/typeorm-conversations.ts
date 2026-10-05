import { randomUUID } from 'node:crypto';
import { DatabaseReady } from '@ciadelivery/shared';
import { Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import {
  ConversationMode,
  MessageAuthor,
  contactLabel,
  inboundBody,
  modeAfterInbound,
  orderNumbersInText,
} from '../domain/conversation';
import {
  ConversationListQuery,
  ConversationMessageRecord,
  ConversationRecord,
  Conversations,
  InboundDraft,
  StoredInbound,
  SystemNotice,
} from '../domain/conversations.port';
import { OrderTemplateKey } from '../domain/order-templates';
import { OutboundMessageStatus } from '../domain/outbound-messages.port';

interface ConversationRow {
  id: string;
  tenantId: string;
  storeId: string;
  customerId: string | null;
  contactPhone: string;
  contactName: string | null;
  mode: ConversationMode;
  linkedOrderId: string | null;
  lastMessageAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface MessageRow {
  id: string;
  direction: 'IN' | 'OUT';
  author: MessageAuthor;
  body: string;
  templateKey: OrderTemplateKey | null;
  status: OutboundMessageStatus;
  createdAt: Date | string;
}

@Injectable()
export class TypeOrmConversations implements Conversations {
  constructor(private readonly database: DatabaseReady) {}

  async acceptInbound(draft: InboundDraft): Promise<StoredInbound> {
    const source = await this.database.ensure();
    const query = source.createQueryRunner();
    await query.connect();
    await query.startTransaction();
    try {
      const existing: Array<{ id: string }> = await query.query(
        `SELECT id FROM whatsapp_messages WHERE external_id = ? LIMIT 1`,
        [draft.externalId],
      );
      if (existing.length > 0) {
        await query.commitTransaction();
        return emptyInbound();
      }

      const customer = await this.customer(
        query,
        draft.tenantId,
        draft.contactPhone,
      );
      const linkedOrderId = await this.orderId(query, draft.tenantId, draft.body);
      const conversation = await this.openConversation(query, draft, customer, linkedOrderId);
      const messageId = randomUUID();
      await query.query(
        `INSERT INTO whatsapp_messages (
           id, tenant_id, conversation_id, direction, author, to_phone,
           template_key, body, status, provider_message_id, event_id,
           external_id, last_error, created_at
         ) VALUES (?, ?, ?, 'IN', 'CUSTOMER', ?, NULL, ?, 'SENT', NULL, NULL, ?, NULL, ?)`,
        [
          messageId,
          draft.tenantId,
          conversation.id,
          draft.contactPhone,
          inboundBody(draft.body),
          draft.externalId,
          draft.receivedAt,
        ],
      );
      await query.commitTransaction();
      return {
        inserted: true,
        conversationId: conversation.id,
        messageId,
        storeId: draft.storeId,
        body: inboundBody(draft.body),
        createdAt: draft.receivedAt,
      };
    } catch (error) {
      await query.rollbackTransaction();
      if (isDuplicate(error)) {
        return emptyInbound();
      }
      throw error;
    } finally {
      await query.release();
    }
  }

  async recordSystemNotice(notice: SystemNotice): Promise<void> {
    const source = await this.database.ensure();
    const linked: Array<{ conversation_id: string | null }> = await source.query(
      `SELECT conversation_id FROM whatsapp_messages WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [notice.messageId, notice.tenantId],
    );
    const row = linked[0];
    if (row === undefined || row.conversation_id !== null) {
      return;
    }

    const conversationId = await this.noticeConversation(notice);
    await source.query(
      `UPDATE whatsapp_messages
          SET conversation_id = ?, author = 'SYSTEM'
        WHERE id = ? AND tenant_id = ? AND conversation_id IS NULL`,
      [conversationId, notice.messageId, notice.tenantId],
    );
  }

  async findInStore(
    tenantId: string,
    storeId: string,
    id: string,
  ): Promise<ConversationRecord | null> {
    const source = await this.database.ensure();
    const rows: ConversationRow[] = await source.query(
      `${conversationSelect()}
        WHERE tenant_id = ? AND store_id = ? AND id = ?
        LIMIT 1`,
      [tenantId, storeId, id],
    );
    const row = rows[0];
    return row === undefined ? null : toConversation(row);
  }

  async list(
    query: ConversationListQuery,
  ): Promise<{ data: ConversationRecord[]; total: number }> {
    const source = await this.database.ensure();
    const offset = (query.page - 1) * query.pageSize;
    const rows: ConversationRow[] = await source.query(
      `${conversationSelect()}
        WHERE tenant_id = ? AND store_id = ?
        ORDER BY last_message_at DESC, id DESC
        LIMIT ? OFFSET ?`,
      [query.tenantId, query.storeId, query.pageSize, offset],
    );
    const totals: Array<{ total: number | string }> = await source.query(
      `SELECT COUNT(*) AS total FROM conversations WHERE tenant_id = ? AND store_id = ?`,
      [query.tenantId, query.storeId],
    );
    return { data: rows.map(toConversation), total: Number(totals[0]?.total ?? 0) };
  }

  async listMessages(
    tenantId: string,
    conversationId: string,
    page: number,
    pageSize: number,
  ): Promise<{ data: ConversationMessageRecord[]; total: number }> {
    const source = await this.database.ensure();
    const offset = (page - 1) * pageSize;
    const rows: MessageRow[] = await source.query(
      `SELECT id, direction, author, body, template_key AS templateKey,
              status, created_at AS createdAt
         FROM whatsapp_messages
        WHERE tenant_id = ? AND conversation_id = ?
        ORDER BY created_at ASC, id ASC
        LIMIT ? OFFSET ?`,
      [tenantId, conversationId, pageSize, offset],
    );
    const totals: Array<{ total: number | string }> = await source.query(
      `SELECT COUNT(*) AS total
         FROM whatsapp_messages
        WHERE tenant_id = ? AND conversation_id = ?`,
      [tenantId, conversationId],
    );
    return {
      data: rows.map((row) => ({
        id: row.id,
        direction: row.direction,
        author: row.author,
        body: row.body,
        templateKey: row.templateKey,
        status: row.status,
        createdAt: asDate(row.createdAt),
      })),
      total: Number(totals[0]?.total ?? 0),
    };
  }

  async touch(tenantId: string, id: string, at: Date): Promise<void> {
    const source = await this.database.ensure();
    await source.query(
      `UPDATE conversations
          SET last_message_at = ?, updated_at = ?
        WHERE tenant_id = ? AND id = ?`,
      [at, at, tenantId, id],
    );
  }

  async close(
    tenantId: string,
    storeId: string,
    id: string,
    at: Date,
  ): Promise<void> {
    const source = await this.database.ensure();
    await source.query(
      `UPDATE conversations
          SET mode = 'CLOSED', updated_at = ?
        WHERE tenant_id = ? AND store_id = ? AND id = ? AND mode <> 'CLOSED'`,
      [at, tenantId, storeId, id],
    );
  }

  private async openConversation(
    query: Query,
    draft: InboundDraft,
    customer: { id: string; name: string } | null,
    linkedOrderId: string | null,
  ): Promise<{ id: string }> {
    const open: ConversationRow[] = await query.query(
      `${conversationSelect()}
        WHERE tenant_id = ? AND contact_phone = ? AND mode <> 'CLOSED'
        LIMIT 1
        FOR UPDATE`,
      [draft.tenantId, draft.contactPhone],
    );
    const current = open[0];
    if (current !== undefined) {
      const mode = modeAfterInbound(current.mode);
      await query.query(
        `UPDATE conversations
            SET mode = ?,
                customer_id = COALESCE(customer_id, ?),
                contact_name = COALESCE(contact_name, ?),
                linked_order_id = COALESCE(?, linked_order_id),
                last_message_at = ?,
                updated_at = ?
          WHERE id = ? AND tenant_id = ?`,
        [
          mode,
          customer?.id ?? null,
          contactLabel(draft.contactName ?? customer?.name),
          linkedOrderId,
          draft.receivedAt,
          draft.receivedAt,
          current.id,
          draft.tenantId,
        ],
      );
      return { id: current.id };
    }

    const closed: Array<{ id: string }> = await query.query(
      `SELECT id FROM conversations
        WHERE tenant_id = ? AND contact_phone = ? AND mode = 'CLOSED'
        ORDER BY updated_at DESC
        LIMIT 1
        FOR UPDATE`,
      [draft.tenantId, draft.contactPhone],
    );
    if (closed[0] !== undefined) {
      await query.query(
        `UPDATE conversations
            SET mode = 'HUMAN',
                store_id = ?,
                customer_id = COALESCE(customer_id, ?),
                contact_name = COALESCE(contact_name, ?),
                linked_order_id = COALESCE(?, linked_order_id),
                last_message_at = ?,
                updated_at = ?
          WHERE id = ? AND tenant_id = ?`,
        [
          draft.storeId,
          customer?.id ?? null,
          contactLabel(draft.contactName ?? customer?.name),
          linkedOrderId,
          draft.receivedAt,
          draft.receivedAt,
          closed[0].id,
          draft.tenantId,
        ],
      );
      return { id: closed[0].id };
    }

    const id = randomUUID();
    try {
      await query.query(
        `INSERT INTO conversations (
           id, tenant_id, store_id, customer_id, contact_phone, contact_name,
           mode, linked_order_id, last_message_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'HUMAN', ?, ?, ?, ?)`,
        [
          id,
          draft.tenantId,
          draft.storeId,
          customer?.id ?? null,
          draft.contactPhone,
          contactLabel(draft.contactName ?? customer?.name),
          linkedOrderId,
          draft.receivedAt,
          draft.receivedAt,
          draft.receivedAt,
        ],
      );
      return { id };
    } catch (error) {
      if (!isDuplicate(error)) {
        throw error;
      }
      const again: Array<{ id: string }> = await query.query(
        `SELECT id FROM conversations
          WHERE tenant_id = ? AND contact_phone = ? AND mode <> 'CLOSED'
          LIMIT 1
          FOR UPDATE`,
        [draft.tenantId, draft.contactPhone],
      );
      if (again[0] === undefined) {
        throw error;
      }
      await query.query(
        `UPDATE conversations
            SET customer_id = COALESCE(customer_id, ?),
                contact_name = COALESCE(contact_name, ?),
                linked_order_id = COALESCE(?, linked_order_id),
                last_message_at = ?,
                updated_at = ?
          WHERE id = ? AND tenant_id = ?`,
        [
          customer?.id ?? null,
          contactLabel(draft.contactName ?? customer?.name),
          linkedOrderId,
          draft.receivedAt,
          draft.receivedAt,
          again[0].id,
          draft.tenantId,
        ],
      );
      return { id: again[0].id };
    }
  }

  private async noticeConversation(notice: SystemNotice): Promise<string> {
    const source = await this.database.ensure();
    const open: Array<{ id: string }> = await source.query(
      `SELECT id FROM conversations
        WHERE tenant_id = ? AND contact_phone = ? AND mode <> 'CLOSED'
        LIMIT 1`,
      [notice.tenantId, notice.contactPhone],
    );
    if (open[0] !== undefined) {
      return open[0].id;
    }
    const latest: Array<{ id: string }> = await source.query(
      `SELECT id FROM conversations
        WHERE tenant_id = ? AND contact_phone = ?
        ORDER BY updated_at DESC
        LIMIT 1`,
      [notice.tenantId, notice.contactPhone],
    );
    if (latest[0] !== undefined) {
      return latest[0].id;
    }

    const id = randomUUID();
    try {
      await source.query(
        `INSERT INTO conversations (
           id, tenant_id, store_id, customer_id, contact_phone, contact_name,
           mode, linked_order_id, last_message_at, created_at, updated_at
         ) VALUES (?, ?, ?, NULL, ?, ?, 'HUMAN', NULL, ?, ?, ?)`,
        [
          id,
          notice.tenantId,
          notice.storeId,
          notice.contactPhone,
          contactLabel(notice.contactName),
          notice.at,
          notice.at,
          notice.at,
        ],
      );
      return id;
    } catch (error) {
      if (!isDuplicate(error)) {
        throw error;
      }
      const again: Array<{ id: string }> = await source.query(
        `SELECT id FROM conversations
          WHERE tenant_id = ? AND contact_phone = ? AND mode <> 'CLOSED'
          LIMIT 1`,
        [notice.tenantId, notice.contactPhone],
      );
      if (again[0] === undefined) {
        throw error;
      }
      return again[0].id;
    }
  }

  private async customer(
    query: Query,
    tenantId: string,
    phone: string,
  ): Promise<{ id: string; name: string } | null> {
    const rows: Array<{ id: string; name: string }> = await query.query(
      `SELECT id, name FROM customers WHERE tenant_id = ? AND phone = ? LIMIT 1`,
      [tenantId, phone],
    );
    return rows[0] ?? null;
  }

  private async orderId(
    query: Query,
    tenantId: string,
    body: string,
  ): Promise<string | null> {
    for (const orderNumber of orderNumbersInText(body)) {
      const rows: Array<{ id: string }> = await query.query(
        `SELECT id FROM orders WHERE tenant_id = ? AND order_number = ? LIMIT 1`,
        [tenantId, orderNumber],
      );
      if (rows[0] !== undefined) {
        return rows[0].id;
      }
    }
    return null;
  }
}

interface Query {
  query<T = unknown>(sql: string, parameters?: unknown[]): Promise<T>;
}

function conversationSelect(): string {
  return `SELECT id, tenant_id AS tenantId, store_id AS storeId, customer_id AS customerId,
                 contact_phone AS contactPhone, contact_name AS contactName, mode,
                 linked_order_id AS linkedOrderId, last_message_at AS lastMessageAt,
                 created_at AS createdAt, updated_at AS updatedAt
            FROM conversations`;
}

function toConversation(row: ConversationRow): ConversationRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    storeId: row.storeId,
    customerId: row.customerId,
    contactPhone: row.contactPhone,
    contactName: row.contactName,
    mode: row.mode,
    linkedOrderId: row.linkedOrderId,
    lastMessageAt: asDate(row.lastMessageAt),
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
  };
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function emptyInbound(): StoredInbound {
  return {
    inserted: false,
    conversationId: null,
    messageId: null,
    storeId: null,
    body: '',
    createdAt: null,
  };
}

function isDuplicate(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error as QueryFailedError & { driverError?: { code?: string } }).driverError
      ?.code === 'ER_DUP_ENTRY'
  );
}
