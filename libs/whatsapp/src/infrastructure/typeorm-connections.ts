import { DatabaseReady } from '@ciadelivery/shared';
import { Injectable } from '@nestjs/common';
import {
  WhatsAppConnectionRecord,
  WhatsAppConnections,
} from '../domain/connections.port';
import { WhatsAppConnectionEntity } from './whatsapp.entities';

@Injectable()
export class TypeOrmWhatsAppConnections implements WhatsAppConnections {
  constructor(private readonly database: DatabaseReady) {}

  async findForStore(
    tenantId: string,
    storeId: string,
  ): Promise<WhatsAppConnectionRecord | null> {
    const source = await this.database.ensure();
    const row = await source.getRepository(WhatsAppConnectionEntity).findOne({
      where: { tenantId, storeId },
    });
    return row === null ? null : toRecord(row);
  }

  async findConnectedByPhoneNumberId(
    phoneNumberId: string,
  ): Promise<WhatsAppConnectionRecord | null> {
    const source = await this.database.ensure();
    const row = await source.getRepository(WhatsAppConnectionEntity).findOne({
      where: { phoneNumberId, status: 'CONNECTED' },
    });
    return row === null ? null : toRecord(row);
  }

  async findConnectedForTenant(
    tenantId: string,
  ): Promise<WhatsAppConnectionRecord | null> {
    const source = await this.database.ensure();
    const row = await source.getRepository(WhatsAppConnectionEntity).findOne({
      where: { tenantId, status: 'CONNECTED' },
    });
    return row === null ? null : toRecord(row);
  }

  async save(connection: WhatsAppConnectionRecord): Promise<void> {
    const source = await this.database.ensure();
    await source.getRepository(WhatsAppConnectionEntity).save(toEntity(connection));
  }
}

function toRecord(row: WhatsAppConnectionEntity): WhatsAppConnectionRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    storeId: row.storeId,
    provider: row.provider,
    phoneNumber: row.phoneNumber,
    businessAccountId: row.businessAccountId,
    phoneNumberId: row.phoneNumberId,
    status: row.status,
    encryptedCredentials: row.encryptedCredentials,
    connectedAt: row.connectedAt,
    disconnectedAt: row.disconnectedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toEntity(connection: WhatsAppConnectionRecord): WhatsAppConnectionEntity {
  const row = new WhatsAppConnectionEntity();
  row.id = connection.id;
  row.tenantId = connection.tenantId;
  row.storeId = connection.storeId;
  row.provider = connection.provider;
  row.phoneNumber = connection.phoneNumber;
  row.businessAccountId = connection.businessAccountId;
  row.phoneNumberId = connection.phoneNumberId;
  row.status = connection.status;
  row.encryptedCredentials = connection.encryptedCredentials;
  row.connectedAt = connection.connectedAt;
  row.disconnectedAt = connection.disconnectedAt;
  row.createdAt = connection.createdAt;
  row.updatedAt = connection.updatedAt;
  return row;
}
