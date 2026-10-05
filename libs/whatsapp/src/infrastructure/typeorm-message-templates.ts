import { DatabaseReady } from '@ciadelivery/shared';
import { Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import {
  MessageTemplateRecord,
  MessageTemplates,
} from '../domain/message-templates.port';
import { OrderTemplateKey } from '../domain/order-templates';
import { MessageTemplateEntity } from './whatsapp.entities';

@Injectable()
export class TypeOrmMessageTemplates implements MessageTemplates {
  constructor(private readonly database: DatabaseReady) {}

  async listForTenant(tenantId: string): Promise<MessageTemplateRecord[]> {
    const source = await this.database.ensure();
    const rows = await source.getRepository(MessageTemplateEntity).find({
      where: { tenantId },
    });
    return rows.map(toRecord);
  }

  async find(
    tenantId: string,
    key: OrderTemplateKey,
  ): Promise<MessageTemplateRecord | null> {
    const source = await this.database.ensure();
    const row = await source.getRepository(MessageTemplateEntity).findOne({
      where: { tenantId, key },
    });
    return row === null ? null : toRecord(row);
  }

  async insertIfAbsent(template: MessageTemplateRecord): Promise<void> {
    const source = await this.database.ensure();
    try {
      await source.getRepository(MessageTemplateEntity).insert(toEntity(template));
    } catch (error) {
      if (!isDuplicate(error)) {
        throw error;
      }
    }
  }

  async setEnabled(
    tenantId: string,
    key: OrderTemplateKey,
    enabled: boolean,
  ): Promise<boolean> {
    const source = await this.database.ensure();
    const result = await source
      .getRepository(MessageTemplateEntity)
      .update({ tenantId, key }, { enabled });
    return (result.affected ?? 0) > 0;
  }
}

function toRecord(row: MessageTemplateEntity): MessageTemplateRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    key: row.key,
    language: row.language,
    metaTemplateName: row.metaTemplateName,
    enabled: Boolean(row.enabled),
  };
}

function toEntity(template: MessageTemplateRecord): MessageTemplateEntity {
  const row = new MessageTemplateEntity();
  row.id = template.id;
  row.tenantId = template.tenantId;
  row.key = template.key;
  row.language = template.language;
  row.metaTemplateName = template.metaTemplateName;
  row.enabled = template.enabled;
  return row;
}

function isDuplicate(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error as QueryFailedError & { driverError?: { code?: string } }).driverError
      ?.code === 'ER_DUP_ENTRY'
  );
}
