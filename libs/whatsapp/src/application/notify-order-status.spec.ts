import { encryptCredentials, decodeCredentialsKey } from '../domain/credentials-cipher';
import { WhatsAppConnectionRecord, WhatsAppConnections } from '../domain/connections.port';
import { MessageTemplateRecord, MessageTemplates } from '../domain/message-templates.port';
import { OrderNotice, OrderNotices, StatusEventRecord, StatusEvents } from '../domain/order-notices.port';
import { OrderTemplateKey } from '../domain/order-templates';
import { Conversations, SystemNotice } from '../domain/conversations.port';
import {
  OutboundMessageRecord,
  OutboundMessages,
} from '../domain/outbound-messages.port';
import { TemplateNotApprovedError } from '../domain/template-approval';
import {
  SendTemplateInput,
  SendTextInput,
  WhatsAppProvider,
} from '../domain/whatsapp-provider';
import { LoggingWhatsAppProvider } from '../infrastructure/whatsapp-providers';
import { NotifyOrderStatus } from './notify-order-status';

const KEY = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';

describe('NotifyOrderStatus', () => {
  const order: OrderNotice = {
    tenantId: 'tenant-a',
    storeId: 'store-a',
    orderId: 'order-1',
    orderNumber: 12,
    status: 'ACCEPTED',
    customerName: 'Ana',
    customerPhone: '11988887777',
    totalCents: 3990,
    source: 'STOREFRONT',
    storeName: 'Pizzaria',
    hasTrackingToken: true,
  };

  it('builds the message from the stored order and sends once', async () => {
    const harness = createHarness(order);
    await harness.notify.execute('event-1', 1);
    await harness.notify.execute('event-1', 1);

    const logged = harness.provider as LoggingWhatsAppProvider;
    expect(logged.outbox).toHaveLength(1);
    expect(logged.outbox[0]).toMatchObject({
      kind: 'template',
      to: '5511988887777',
    });
    expect(logged.outbox[0]?.id).toMatch(/^log-/);
    const sent = harness.messages.rows.find((row) => row.status === 'SENT');
    expect(sent?.tenantId).toBe('tenant-a');
    expect(sent?.templateKey).toBe('order_accepted');
    expect(sent?.body).toContain('Ana');
    expect(sent?.body).toContain('R$ 39,90');
    expect(sent?.body).not.toContain('/pedido/');
    expect(sent?.body).not.toContain('Invasor');
    expect(sent?.providerMessageId).toBe(logged.outbox[0]?.id);
    expect(sent?.author).toBe('SYSTEM');
    expect(harness.inbox.created).toBe(1);
    expect(sent?.conversationId).toBe(harness.inbox.conversationId);
  });

  it('skips a store without a connection and does not call the provider', async () => {
    const harness = createHarness(order, { connected: false });
    await harness.notify.execute('event-1', 1);
    expect((harness.provider as LoggingWhatsAppProvider).outbox).toHaveLength(0);
    expect(harness.messages.rows.map((row) => row.status)).toEqual(['SKIPPED']);
    expect(harness.messages.rows[0]?.lastError).toBe('NO_CONNECTION');
    expect(harness.inbox.created).toBe(0);
  });

  it('does not call the provider when the template is off', async () => {
    const harness = createHarness(order, { enabled: false });
    await harness.notify.execute('event-1', 1);
    expect((harness.provider as LoggingWhatsAppProvider).outbox).toHaveLength(0);
    expect(harness.messages.rows[0]?.status).toBe('SKIPPED');
    expect(harness.messages.rows[0]?.lastError).toBe('TEMPLATE_DISABLED');
  });

  it('does not create or send a WhatsApp message for a test order', async () => {
    const harness = createHarness({ ...order, source: 'TEST' });
    await harness.notify.execute('event-1', 1);
    expect(harness.messages.rows).toEqual([]);
    expect((harness.provider as LoggingWhatsAppProvider).outbox).toEqual([]);
    expect(harness.inbox.created).toBe(0);
  });

  it('does not duplicate the creation reply for a WhatsApp order', async () => {
    const harness = createHarness({ ...order, source: 'WHATSAPP' });
    harness.events.event.type = 'order.created';
    await harness.notify.execute('event-1', 1);
    expect(harness.messages.rows).toEqual([]);
    expect((harness.provider as LoggingWhatsAppProvider).outbox).toEqual([]);
  });

  it('does not write a message for another tenant', async () => {
    const harness = createHarness(order);
    harness.events.event = {
      id: 'event-b',
      tenantId: 'tenant-b',
      type: 'order.accepted',
      orderId: order.orderId,
    };
    await harness.notify.execute('event-b', 1);
    expect(harness.messages.rows).toEqual([]);
    expect((harness.provider as LoggingWhatsAppProvider).outbox).toHaveLength(0);
  });

  it('fails with TEMPLATE_NOT_APPROVED after the last attempt and skips free text', async () => {
    const harness = createHarness(order, { driver: 'meta', session: false });
    const provider = harness.provider as MemoryProvider;
    provider.failTemplate = true;
    await harness.notify.execute('event-1', 5);
    expect(provider.texts).toHaveLength(0);
    expect(harness.messages.rows[0]?.status).toBe('FAILED');
    expect(harness.messages.rows[0]?.lastError).toBe('TEMPLATE_NOT_APPROVED');
  });

  it('retries a failing provider without a second message and logs no token', async () => {
    const lines: string[] = [];
    const write = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk) => {
        lines.push(String(chunk));
        return true;
      });
    try {
      const harness = createHarness(order, { driver: 'meta' });
      const provider = harness.provider as MemoryProvider;
      provider.failuresLeft = 2;
      await expect(harness.notify.execute('event-1', 1)).rejects.toThrow(
        'temporary',
      );
      await expect(harness.notify.execute('event-1', 2)).rejects.toThrow(
        'temporary',
      );
      await harness.notify.execute('event-1', 3);

      expect(harness.messages.rows).toHaveLength(1);
      expect(harness.messages.rows[0]?.status).toBe('SENT');
      expect(provider.templateCalls).toBe(3);
      const logged = lines
        .map((line) => JSON.parse(line) as { message: string })
        .map((line) => JSON.parse(line.message) as { outcome: string; phone: string });
      expect(logged.map((line) => line.outcome)).toEqual(['retry', 'retry', 'sent']);
      expect(logged[0]?.phone).toBe('*********7777');
      expect(lines.join('\n')).not.toContain('store-token');
      expect(lines.join('\n')).not.toContain('/pedido/');
    } finally {
      write.mockRestore();
    }
  });

  it('falls back to session text outside production when the flag is on', async () => {
    const harness = createHarness(order, { driver: 'meta', session: true });
    const provider = harness.provider as MemoryProvider;
    provider.failTemplate = true;
    await harness.notify.execute('event-1', 1);
    expect(provider.texts).toHaveLength(1);
    expect(provider.texts[0]?.body).toContain('Ana');
    expect(provider.texts[0]?.body).not.toContain('/pedido/');
    expect(harness.messages.rows[0]?.status).toBe('SENT');
  });
});

function createHarness(
  order: OrderNotice,
  options: { connected?: boolean; enabled?: boolean; driver?: 'log' | 'meta'; session?: boolean } = {},
) {
  const key = decodeCredentialsKey(KEY);
  if (key === null) {
    throw new Error('missing key');
  }
  const events = new MemoryEvents({
    id: 'event-1',
    tenantId: order.tenantId,
    type: 'order.accepted',
    orderId: order.orderId,
  });
  const orders = new MemoryOrders(order);
  const connections = new MemoryConnections(
    options.connected === false
      ? null
      : {
          id: 'conn-1',
          tenantId: order.tenantId,
          storeId: order.storeId,
          provider: 'META_CLOUD',
          phoneNumber: '+5511988887777',
          businessAccountId: '1',
          phoneNumberId: '106540352242922',
          status: 'CONNECTED',
          encryptedCredentials: encryptCredentials('store-token', key),
          connectedAt: new Date(),
          disconnectedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
  );
  const templates = new MemoryTemplates({
    id: 'tpl-1',
    tenantId: order.tenantId,
    key: 'order_accepted',
    language: 'pt_BR',
    metaTemplateName: 'order_accepted',
    enabled: options.enabled ?? true,
  });
  const messages = new MemoryMessages();
  const inbox = new MemoryInbox(messages);
  const provider: WhatsAppProvider =
    options.driver === 'meta'
      ? new MemoryProvider()
      : new LoggingWhatsAppProvider('app-secret');
  const notify = new NotifyOrderStatus(
    events,
    orders,
    connections,
    templates,
    messages,
    inbox,
    provider,
    {
      encryptionKey: KEY,
      allowSessionMessages: options.session === true,
      driver: options.driver ?? 'log',
    },
  );
  return { notify, provider, messages, events, inbox };
}

class MemoryEvents implements StatusEvents {
  constructor(public event: StatusEventRecord) {}

  find(id: string): Promise<StatusEventRecord | null> {
    return Promise.resolve(this.event.id === id ? this.event : null);
  }
}

class MemoryOrders implements OrderNotices {
  constructor(private readonly order: OrderNotice) {}

  find(tenantId: string, orderId: string): Promise<OrderNotice | null> {
    if (tenantId !== this.order.tenantId || orderId !== this.order.orderId) {
      return Promise.resolve(null);
    }
    return Promise.resolve(this.order);
  }
}

class MemoryConnections implements WhatsAppConnections {
  constructor(private readonly connection: WhatsAppConnectionRecord | null) {}

  findForStore(): Promise<WhatsAppConnectionRecord | null> {
    return Promise.resolve(this.connection);
  }

  findConnectedByPhoneNumberId(): Promise<WhatsAppConnectionRecord | null> {
    return Promise.resolve(this.connection);
  }

  findConnectedForTenant(tenantId: string): Promise<WhatsAppConnectionRecord | null> {
    if (this.connection === null || this.connection.tenantId !== tenantId) {
      return Promise.resolve(null);
    }
    return Promise.resolve(this.connection);
  }

  save(): Promise<void> {
    return Promise.resolve();
  }
}

class MemoryTemplates implements MessageTemplates {
  constructor(private readonly template: MessageTemplateRecord | null) {}

  listForTenant(): Promise<MessageTemplateRecord[]> {
    return Promise.resolve(this.template === null ? [] : [this.template]);
  }

  find(tenantId: string, key: OrderTemplateKey): Promise<MessageTemplateRecord | null> {
    if (
      this.template === null ||
      this.template.tenantId !== tenantId ||
      this.template.key !== key
    ) {
      return Promise.resolve(null);
    }
    return Promise.resolve(this.template);
  }

  insertIfAbsent(): Promise<void> {
    return Promise.resolve();
  }

  setEnabled(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

class MemoryMessages implements OutboundMessages {
  readonly rows: OutboundMessageRecord[] = [];

  findByEventId(eventId: string): Promise<OutboundMessageRecord | null> {
    return Promise.resolve(
      this.rows.find((row) => row.eventId !== null && row.eventId === eventId) ?? null,
    );
  }

  findById(id: string): Promise<OutboundMessageRecord | null> {
    return Promise.resolve(this.rows.find((row) => row.id === id) ?? null);
  }

  insert(message: OutboundMessageRecord): Promise<'inserted' | 'duplicate'> {
    if (
      message.eventId !== null &&
      this.rows.some((row) => row.eventId === message.eventId)
    ) {
      return Promise.resolve('duplicate');
    }
    this.rows.push(message);
    return Promise.resolve('inserted');
  }

  remove(id: string, tenantId: string): Promise<void> {
    const index = this.rows.findIndex(
      (row) => row.id === id && row.tenantId === tenantId,
    );
    if (index >= 0) {
      this.rows.splice(index, 1);
    }
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

  markFailed(id: string, tenantId: string, lastError: string): Promise<void> {
    const row = this.rows.find((item) => item.id === id && item.tenantId === tenantId);
    if (row !== undefined) {
      row.status = 'FAILED';
      row.lastError = lastError;
    }
    return Promise.resolve();
  }

  markSkipped(id: string, tenantId: string, reason: string): Promise<void> {
    const row = this.rows.find((item) => item.id === id && item.tenantId === tenantId);
    if (row !== undefined) {
      row.status = 'SKIPPED';
      row.lastError = reason;
    }
    return Promise.resolve();
  }

  latestFailure(): Promise<null> {
    return Promise.resolve(null);
  }

  listRecentSystem(): Promise<[]> {
    return Promise.resolve([]);
  }
}

class MemoryInbox implements Conversations {
  created = 0;
  conversationId: string | null = null;

  constructor(private readonly messages: MemoryMessages) {}

  acceptInbound(): Promise<never> {
    return Promise.reject(new Error('unused'));
  }

  recordSystemNotice(notice: SystemNotice): Promise<void> {
    const row = this.messages.rows.find((item) => item.id === notice.messageId);
    if (row === undefined || row.conversationId !== null) {
      return Promise.resolve();
    }
    this.created += 1;
    this.conversationId = '33333333-3333-4333-8333-333333333333';
    row.conversationId = this.conversationId;
    row.author = 'SYSTEM';
    return Promise.resolve();
  }

  findInStore(): Promise<null> {
    return Promise.resolve(null);
  }

  list(): Promise<{ data: []; total: number }> {
    return Promise.resolve({ data: [], total: 0 });
  }

  listMessages(): Promise<{ data: []; total: number }> {
    return Promise.resolve({ data: [], total: 0 });
  }

  recentMessages(): Promise<[]> {
    return Promise.resolve([]);
  }

  setMode(): Promise<boolean> {
    return Promise.resolve(false);
  }

  touch(): Promise<void> {
    return Promise.resolve();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

class MemoryProvider implements WhatsAppProvider {
  readonly templates: SendTemplateInput[] = [];
  readonly texts: SendTextInput[] = [];
  failTemplate = false;
  failuresLeft = 0;
  templateCalls = 0;
  private sequence = 0;

  sendTemplate(input: SendTemplateInput): Promise<{ id: string }> {
    this.templateCalls += 1;
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      return Promise.reject(new Error('temporary'));
    }
    if (this.failTemplate) {
      return Promise.reject(new TemplateNotApprovedError());
    }
    this.templates.push(input);
    this.sequence += 1;
    return Promise.resolve({ id: `log-00000000-0000-4000-8000-00000000000${this.sequence}` });
  }

  sendText(input: SendTextInput): Promise<{ id: string }> {
    this.texts.push(input);
    return Promise.resolve({ id: 'log-session' });
  }

  parseWebhook(): { messages: [] } {
    return { messages: [] };
  }

  verifySignature(): boolean {
    return true;
  }
}
