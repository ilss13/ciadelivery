import { encryptCredentials, decodeCredentialsKey } from '../domain/credentials-cipher';
import { WhatsAppConnectionRecord, WhatsAppConnections } from '../domain/connections.port';
import {
  OutboundMessageRecord,
  OutboundMessages,
} from '../domain/outbound-messages.port';
import { LoggingWhatsAppProvider } from '../infrastructure/whatsapp-providers';
import { SendQueuedText } from './send-queued-text';

const KEY = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';

describe('SendQueuedText', () => {
  it('calls the provider once and keeps a second run from sending again', async () => {
    const key = decodeCredentialsKey(KEY);
    if (key === null) {
      throw new Error('missing key');
    }
    const message = draft();
    const messages = new MemoryMessages([message]);
    const provider = new LoggingWhatsAppProvider('app-secret');
    const send = new SendQueuedText(
      messages,
      new MemoryConnections(message.tenantId, encryptCredentials('token-value', key)),
      provider,
      KEY,
    );

    await send.execute(message.id, 1);
    await send.execute(message.id, 1);

    expect(provider.outbox).toEqual([
      expect.objectContaining({ kind: 'text', to: '5511999999999' }),
    ]);
    expect(JSON.stringify(provider.outbox)).not.toContain('token-value');
    expect(messages.rows[0]?.status).toBe('SENT');
    expect(messages.rows[0]?.providerMessageId).toBe(provider.outbox[0]?.id);
  });
});

function draft(): OutboundMessageRecord {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: 'tenant-a',
    conversationId: '22222222-2222-4222-8222-222222222222',
    direction: 'OUT',
    author: 'USER',
    toPhone: '5511999999999',
    templateKey: null,
    body: 'olá',
    status: 'QUEUED',
    providerMessageId: null,
    eventId: null,
    externalId: null,
    lastError: null,
    createdAt: new Date('2026-10-05T12:00:00.000Z'),
  };
}

function connected(encryptedCredentials: string): WhatsAppConnectionRecord {
  return {
    id: 'conn',
    tenantId: 'tenant-a',
    storeId: 'store-a',
    provider: 'META_CLOUD',
    phoneNumber: '+5511888887777',
    businessAccountId: '1',
    phoneNumberId: '106540352242922',
    status: 'CONNECTED',
    encryptedCredentials,
    connectedAt: new Date(),
    disconnectedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

class MemoryMessages implements OutboundMessages {
  constructor(readonly rows: OutboundMessageRecord[]) {}

  findByEventId(): Promise<OutboundMessageRecord | null> {
    return Promise.resolve(null);
  }

  findById(id: string): Promise<OutboundMessageRecord | null> {
    return Promise.resolve(this.rows.find((row) => row.id === id) ?? null);
  }

  insert(): Promise<'inserted' | 'duplicate'> {
    return Promise.resolve('inserted');
  }

  remove(): Promise<void> {
    return Promise.resolve();
  }

  markSent(id: string, tenantId: string, providerMessageId: string): Promise<void> {
    const row = this.rows.find((item) => item.id === id && item.tenantId === tenantId);
    if (row !== undefined) {
      row.status = 'SENT';
      row.providerMessageId = providerMessageId;
    }
    return Promise.resolve();
  }

  markFailed(): Promise<void> {
    return Promise.resolve();
  }

  markSkipped(): Promise<void> {
    return Promise.resolve();
  }

  latestFailure(): Promise<null> {
    return Promise.resolve(null);
  }

  listRecentSystem(): Promise<[]> {
    return Promise.resolve([]);
  }
}

class MemoryConnections implements WhatsAppConnections {
  constructor(
    private readonly tenantId: string,
    private readonly encryptedCredentials: string,
  ) {}

  findForStore(): Promise<WhatsAppConnectionRecord | null> {
    return Promise.resolve(null);
  }

  findConnectedByPhoneNumberId(): Promise<WhatsAppConnectionRecord | null> {
    return Promise.resolve(null);
  }

  findConnectedForTenant(tenantId: string): Promise<WhatsAppConnectionRecord | null> {
    if (tenantId !== this.tenantId) {
      return Promise.resolve(null);
    }
    return Promise.resolve(connected(this.encryptedCredentials));
  }

  save(): Promise<void> {
    return Promise.resolve();
  }
}
