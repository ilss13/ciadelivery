import { randomUUID } from 'node:crypto';
import { DatabaseReady } from '@ciadelivery/shared';
import { Injectable } from '@nestjs/common';
import {
  NewWhatsAppWebhookEvent,
  WhatsAppWebhookEvents,
} from '../domain/webhook-events.port';
import { WhatsAppWebhookEventEntity } from './whatsapp.entities';

@Injectable()
export class TypeOrmWhatsAppWebhookEvents implements WhatsAppWebhookEvents {
  constructor(private readonly database: DatabaseReady) {}

  async insertIfAbsent(event: NewWhatsAppWebhookEvent): Promise<boolean> {
    const source = await this.database.ensure();
    try {
      await source.getRepository(WhatsAppWebhookEventEntity).insert({
        id: event.id.length === 0 ? randomUUID() : event.id,
        tenantId: event.tenantId,
        externalId: event.externalId,
        payload:
          event.payload !== null && typeof event.payload === 'object'
            ? event.payload
            : { value: event.payload },
        receivedAt: event.receivedAt,
        processedAt: null,
      });
      return true;
    } catch (error) {
      if (isMysqlDuplicate(error)) {
        return false;
      }
      throw error;
    }
  }
}

function isMysqlDuplicate(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const candidate = error as { code?: string; driverError?: { code?: string } };
  return (candidate.code ?? candidate.driverError?.code) === 'ER_DUP_ENTRY';
}
