import { TransactionContext } from '@ciadelivery/tenancy/domain';

export const WHATSAPP_CONNECTION_STATUSES = [
  'PENDING',
  'CONNECTED',
  'DISCONNECTED',
  'ERROR',
] as const;

export type WhatsAppConnectionStatus =
  (typeof WHATSAPP_CONNECTION_STATUSES)[number];

export interface WhatsAppConnectionRecord {
  id: string;
  tenantId: string;
  storeId: string;
  provider: 'META_CLOUD';
  phoneNumber: string;
  businessAccountId: string;
  phoneNumberId: string;
  status: WhatsAppConnectionStatus;
  encryptedCredentials: string | null;
  connectedAt: Date | null;
  disconnectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhatsAppConnections {
  findForStore(
    tenantId: string,
    storeId: string,
  ): Promise<WhatsAppConnectionRecord | null>;
  findConnectedByPhoneNumberId(
    phoneNumberId: string,
  ): Promise<WhatsAppConnectionRecord | null>;
  findConnectedForTenant(
    tenantId: string,
  ): Promise<WhatsAppConnectionRecord | null>;
  save(
    connection: WhatsAppConnectionRecord,
    tx?: TransactionContext,
  ): Promise<void>;
}

export const WHATSAPP_CONNECTIONS = Symbol('WHATSAPP_CONNECTIONS');
