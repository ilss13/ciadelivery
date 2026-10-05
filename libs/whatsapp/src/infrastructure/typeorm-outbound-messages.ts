import { DatabaseReady } from '@ciadelivery/shared';
import { Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { OrderTemplateKey } from '../domain/order-templates';
import {
  MessageFailure,
  OutboundMessageRecord,
  OutboundMessages,
  SystemSendRecord,
} from '../domain/outbound-messages.port';
import { WhatsAppMessageEntity } from './whatsapp.entities';

@Injectable()
export class TypeOrmOutboundMessages implements OutboundMessages {
  constructor(private readonly database: DatabaseReady) {}

  async findByEventId(eventId: string): Promise<OutboundMessageRecord | null> {
    const source = await this.database.ensure();
    const row = await source.getRepository(WhatsAppMessageEntity).findOne({
      where: { eventId },
    });
    return row === null ? null : toRecord(row);
  }

  async findById(id: string): Promise<OutboundMessageRecord | null> {
    const source = await this.database.ensure();
    const row = await source.getRepository(WhatsAppMessageEntity).findOne({
      where: { id },
    });
    return row === null ? null : toRecord(row);
  }

  async insert(
    message: OutboundMessageRecord,
  ): Promise<'inserted' | 'duplicate'> {
    const source = await this.database.ensure();
    try {
      await source.getRepository(WhatsAppMessageEntity).insert(toEntity(message));
      return 'inserted';
    } catch (error) {
      if (isDuplicate(error)) {
        return 'duplicate';
      }
      throw error;
    }
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const source = await this.database.ensure();
    await source.getRepository(WhatsAppMessageEntity).delete({ id, tenantId });
  }

  async markSent(
    id: string,
    tenantId: string,
    providerMessageId: string,
  ): Promise<void> {
    const source = await this.database.ensure();
    await source.getRepository(WhatsAppMessageEntity).update(
      { id, tenantId },
      { status: 'SENT', providerMessageId, lastError: null },
    );
  }

  async markFailed(
    id: string,
    tenantId: string,
    lastError: string,
  ): Promise<void> {
    const source = await this.database.ensure();
    await source.getRepository(WhatsAppMessageEntity).update(
      { id, tenantId },
      { status: 'FAILED', lastError },
    );
  }

  async markSkipped(
    id: string,
    tenantId: string,
    reason: string,
  ): Promise<void> {
    const source = await this.database.ensure();
    await source.getRepository(WhatsAppMessageEntity).update(
      { id, tenantId },
      { status: 'SKIPPED', lastError: reason, providerMessageId: null },
    );
  }

  async latestFailure(
    tenantId: string,
    templateKey: OrderTemplateKey,
  ): Promise<MessageFailure | null> {
    const source = await this.database.ensure();
    const row = await source.getRepository(WhatsAppMessageEntity).findOne({
      where: { tenantId, templateKey, status: 'FAILED' },
      order: { createdAt: 'DESC' },
    });
    if (row === null || row.lastError === null) {
      return null;
    }
    return { toPhone: row.toPhone, lastError: row.lastError };
  }

  async listRecentSystem(
    tenantId: string,
    limit: number,
  ): Promise<SystemSendRecord[]> {
    const source = await this.database.ensure();
    const rows = await source.getRepository(WhatsAppMessageEntity).find({
      where: { tenantId, author: 'SYSTEM', direction: 'OUT' },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(Math.trunc(limit), 1), 50),
    });
    return rows.map((row) => ({
      id: row.id,
      templateKey: row.templateKey,
      status: row.status,
      createdAt: row.createdAt,
      lastError: row.lastError,
    }));
  }
}

function toRecord(row: WhatsAppMessageEntity): OutboundMessageRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    conversationId: row.conversationId,
    direction: row.direction,
    author: row.author,
    toPhone: row.toPhone,
    templateKey: row.templateKey,
    body: row.body,
    status: row.status,
    providerMessageId: row.providerMessageId,
    eventId: row.eventId,
    externalId: row.externalId,
    lastError: row.lastError,
    createdAt: row.createdAt,
  };
}

function toEntity(message: OutboundMessageRecord): WhatsAppMessageEntity {
  const row = new WhatsAppMessageEntity();
  row.id = message.id;
  row.tenantId = message.tenantId;
  row.conversationId = message.conversationId;
  row.direction = message.direction;
  row.author = message.author;
  row.toPhone = message.toPhone;
  row.templateKey = message.templateKey;
  row.body = message.body;
  row.status = message.status;
  providerMessageId(row, message.providerMessageId);
  row.eventId = message.eventId;
  row.externalId = message.externalId;
  lastError(row, message.lastError);
  row.createdAt = message.createdAt;
  return row;
}

function providerMessageId(
  row: WhatsAppMessageEntity,
  value: string | null,
): void {
  row.providerMessageId = value;
}

function lastError(row: WhatsAppMessageEntity, value: string | null): void {
  row.lastError = value;
}

function isDuplicate(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error as QueryFailedError & { driverError?: { code?: string } }).driverError
      ?.code === 'ER_DUP_ENTRY'
  );
}
