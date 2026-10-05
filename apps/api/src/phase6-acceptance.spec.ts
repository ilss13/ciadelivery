import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NotificationsWorkerModule } from '@ciadelivery/notifications/worker';
import { OutboxWorkerModule } from '@ciadelivery/orders/worker';
import { loadEnvFile, PlatformModule } from '@ciadelivery/shared';
import {
  SendTemplateInput,
  SendTextInput,
  WhatsAppProvider,
  WHATSAPP,
} from '@ciadelivery/whatsapp';
import { WhatsAppWorkerModule } from '@ciadelivery/whatsapp/worker';
import Redis from 'ioredis';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createApiApplication } from './bootstrap';

const envSnapshot = { ...process.env };
const adminEmail = 'platform-admin@ciadelivery.test';
const adminPassword = 'PlatformAdmin1';
const appSecret = 'test-meta-app-secret';
const verifyToken = 'test-verify-token';
const accessToken = 'store-access-token-value';

function sign(raw: string): string {
  return `sha256=${createHmac('sha256', appSecret).update(raw).digest('hex')}`;
}

class ScriptedWhatsApp implements WhatsAppProvider {
  readonly calls: Array<{
    kind: 'template' | 'text';
    to: string;
    phoneNumberId: string;
  }> = [];
  templateFailuresRemaining = 0;
  templateAttempts = 0;

  sendText(input: SendTextInput): Promise<{ id: string }> {
    this.calls.push({
      kind: 'text',
      to: input.to,
      phoneNumberId: input.phoneNumberId,
    });
    return Promise.resolve({ id: `log-${randomUUID()}` });
  }

  sendTemplate(input: SendTemplateInput): Promise<{ id: string }> {
    this.templateAttempts += 1;
    if (this.templateFailuresRemaining > 0) {
      this.templateFailuresRemaining -= 1;
      return Promise.reject(new Error('temporary'));
    }
    this.calls.push({
      kind: 'template',
      to: input.to,
      phoneNumberId: input.phoneNumberId,
    });
    return Promise.resolve({ id: `log-${randomUUID()}` });
  }

  parseWebhook(): { messages: [] } {
    return { messages: [] };
  }

  verifySignature(): boolean {
    return false;
  }
}

describe('phase 6 acceptance', () => {
  jest.setTimeout(90_000);

  let app!: INestApplication;
  let worker!: INestApplication;
  const provider = new ScriptedWhatsApp();
  const createdTenantIds: string[] = [];
  const emails: string[] = [];

  beforeAll(async () => {
    loadEnvFile();
    process.env['NODE_ENV'] = 'local';
    process.env['JWT_ACCESS_SECRET'] =
      process.env['JWT_ACCESS_SECRET'] ??
      'local-development-jwt-access-secret';
    process.env['SEED_PLATFORM_ADMIN'] = 'true';
    process.env['PLATFORM_ADMIN_EMAIL'] = adminEmail;
    process.env['PLATFORM_ADMIN_PASSWORD'] = adminPassword;
    process.env['SEED_DEMO'] = 'false';
    process.env['LOG_PASSWORD_RESET'] = 'false';
    process.env['WHATSAPP_DRIVER'] = 'log';
    process.env['CREDENTIALS_ENCRYPTION_KEY'] =
      'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';
    process.env['META_APP_SECRET'] = appSecret;
    process.env['META_WEBHOOK_VERIFY_TOKEN'] = verifyToken;
    app = await createApiApplication();
    await app.init();

    const moduleRef = await Test.createTestingModule({
      imports: [
        PlatformModule,
        NotificationsWorkerModule,
        WhatsAppWorkerModule,
        OutboxWorkerModule.register({ pollIntervalMs: 100 }),
      ],
    })
      .overrideProvider(WHATSAPP)
      .useValue(provider)
      .compile();
    worker = moduleRef.createNestApplication();
    await worker.init();
  });

  beforeEach(async () => {
    await clearRateLimits();
  });

  afterAll(async () => {
    if (worker !== undefined) {
      await worker.close();
    }
    if (app !== undefined) {
      const dataSource = app.get(DataSource);
      if (dataSource.isInitialized && createdTenantIds.length > 0) {
        const marks = createdTenantIds.map(() => '?').join(', ');
        await dataSource.query(
          `DELETE FROM whatsapp_messages WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM conversations WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM whatsapp_webhook_events WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM message_templates WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM whatsapp_connections WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM notifications WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE pe FROM processed_events pe
           INNER JOIN outbox_events oe ON oe.id = pe.event_id
           WHERE oe.tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM outbox_events WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM order_status_history WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM order_items WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM orders WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM idempotency_records WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM tenant_order_counters WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM customer_consents WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM customer_addresses WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM customers WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM product_options WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM product_option_groups WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM products WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM categories WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM delivery_zones WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM delivery_configs WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM payment_methods WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM business_hours WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM branding_configs WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE tenant_id IN (${marks}))`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE tenant_id IN (${marks}))`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM user_permission_overrides WHERE user_id IN (SELECT id FROM users WHERE tenant_id IN (${marks}))`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM users WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM stores WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM tenants WHERE id IN (${marks})`,
          createdTenantIds,
        );
      }
      if (dataSource.isInitialized && emails.length > 0) {
        const marks = emails.map(() => '?').join(', ');
        await dataSource.query(
          `DELETE FROM login_attempts WHERE email IN (${marks})`,
          emails,
        );
      }
      await app.close();
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    }
    await clearRateLimits();
    for (const key of Object.keys(process.env)) {
      if (!(key in envSnapshot)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, envSnapshot);
  });

  it('notifies the right store, retries without duplicating, and keeps the reply in that tenant', async () => {
    const ownerA = await createOwner('phase6-a', 'Pizzaria A');
    const ownerB = await createOwner('phase6-b', 'Pizzaria B');
    const phoneA = numericId();
    const phoneB = numericId();
    await connect(ownerA.token, phoneA, '+5511977776666');
    await openStore(ownerA.token);
    await openStore(ownerB.token);
    const productA = await createProduct(ownerA.token);
    const productB = await createProduct(ownerB.token);

    provider.templateFailuresRemaining = 2;
    const created = await postOrder(
      ownerA.tenantSlug,
      productA,
      '11988887777',
    ).expect(201);
    const received = await waitForMessage(
      ownerA.tenantId,
      'order_received',
      'SENT',
      25_000,
    );
    expect(received.to_phone).toBe('5511988887777');
    expect(received.provider_message_id).toMatch(/^log-/);
    expect(received.event_id).toEqual(expect.any(String));
    const receivedRows = await messagesFor(ownerA.tenantId, 'order_received');
    expect(receivedRows).toHaveLength(1);
    expect(provider.templateAttempts).toBe(3);
    expect(
      provider.calls.filter(
        (call) => call.kind === 'template' && call.to === '5511988887777',
      ),
    ).toHaveLength(1);
    expect(JSON.stringify(provider.calls)).not.toContain(accessToken);

    const orderId = created.body.orderId as string;
    for (const step of ['accept', 'start-preparation', 'ready'] as const) {
      await request(app.getHttpServer())
        .post(`/api/v1/admin/orders/${orderId}/${step}`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .expect(200);
    }
    await waitForMessage(ownerA.tenantId, 'order_accepted', 'SENT');
    await waitForMessage(ownerA.tenantId, 'order_preparing', 'SENT');
    await waitForMessage(ownerA.tenantId, 'order_ready', 'SENT');
    for (const key of ['order_accepted', 'order_preparing', 'order_ready']) {
      const rows = await messagesFor(ownerA.tenantId, key);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.event_id).toEqual(expect.any(String));
    }
    const eventIds = (
      await app.get(DataSource).query(
        `SELECT event_id FROM whatsapp_messages
          WHERE tenant_id = ? AND template_key IN ('order_received', 'order_accepted', 'order_preparing', 'order_ready')`,
        [ownerA.tenantId],
      )
    ).map((row: { event_id: string }) => row.event_id);
    expect(new Set(eventIds).size).toBe(4);

    const sends = await request(app.getHttpServer())
      .get('/api/v1/admin/whatsapp/sends')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    expect(sends.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          templateKey: 'order_received',
          status: 'SENT',
          createdAt: expect.any(String),
          error: null,
        }),
        expect.objectContaining({ templateKey: 'order_accepted', status: 'SENT' }),
        expect.objectContaining({ templateKey: 'order_preparing', status: 'SENT' }),
        expect.objectContaining({ templateKey: 'order_ready', status: 'SENT' }),
      ]),
    );
    expect(sends.body.data.length).toBeLessThanOrEqual(50);
    expect(JSON.stringify(sends.body)).not.toContain('/pedido/');
    expect(JSON.stringify(sends.body)).not.toContain(accessToken);

    const wamid = `wamid.${randomBytes(6).toString('hex')}`;
    const raw = JSON.stringify(
      webhook(phoneA, wamid, '5511999991234', 'Ana', 'oi'),
    );
    await postWebhook(raw, sign(raw)).expect(200);
    const listed = await request(app.getHttpServer())
      .get('/api/v1/admin/whatsapp/conversations')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    const conversationId = await conversationWithBody(
      ownerA.token,
      listed.body.data as Array<{ id: string }>,
      'oi',
    );
    const reply = 'Olá, já vimos seu pedido';
    await request(app.getHttpServer())
      .post(`/api/v1/admin/whatsapp/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ body: reply })
      .expect(201);
    await waitForBody(ownerA.tenantId, reply, 'SENT');
    const thread = await request(app.getHttpServer())
      .get(`/api/v1/admin/whatsapp/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    expect(thread.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ direction: 'OUT', author: 'USER', body: reply }),
      ]),
    );
    expect(
      provider.calls.filter((call) => call.kind === 'text' && call.to === '5511999991234'),
    ).toHaveLength(1);

    const hiddenList = await request(app.getHttpServer())
      .get('/api/v1/admin/whatsapp/conversations')
      .set('Authorization', `Bearer ${ownerB.token}`)
      .expect(200);
    expect(
      (hiddenList.body.data as Array<{ id: string }>).map((item) => item.id),
    ).not.toContain(conversationId);
    await request(app.getHttpServer())
      .get(`/api/v1/admin/whatsapp/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${ownerB.token}`)
      .expect(404);

    const platform = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(200);
    const platformToken = platform.body.accessToken as string;
    for (const path of [
      '/api/v1/platform/whatsapp/conversations',
      `/api/v1/platform/tenants/${ownerA.tenantId}/whatsapp/conversations`,
    ]) {
      const denied = await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${platformToken}`)
        .expect(404);
      expect(JSON.stringify(denied.body)).not.toContain(reply);
      expect(JSON.stringify(denied.body)).not.toContain('oi');
    }

    await connect(ownerB.token, phoneB, '+5511966665555');
    const beforeB = provider.calls.length;
    await postOrder(ownerB.tenantSlug, productB, '11966665555').expect(201);
    const sentB = await waitForMessage(ownerB.tenantId, 'order_received', 'SENT');
    expect(sentB.to_phone).toBe('5511966665555');
    const callsB = provider.calls.slice(beforeB).filter((call) => call.kind === 'template');
    expect(callsB).toEqual([
      expect.objectContaining({
        to: '5511966665555',
        phoneNumberId: phoneB,
      }),
    ]);
    expect(callsB.some((call) => call.phoneNumberId === phoneA)).toBe(false);
    const leaked = await app.get(DataSource).query(
      `SELECT id FROM whatsapp_messages WHERE tenant_id = ? AND to_phone = ?`,
      [ownerA.tenantId, '5511966665555'],
    );
    expect(leaked).toEqual([]);
    const foreignSends = await request(app.getHttpServer())
      .get('/api/v1/admin/whatsapp/sends')
      .set('Authorization', `Bearer ${ownerB.token}`)
      .expect(200);
    expect(foreignSends.body.data).toEqual([
      expect.objectContaining({ templateKey: 'order_received', status: 'SENT' }),
    ]);
    expect(
      (foreignSends.body.data as Array<{ id: string }>).some((item) =>
        (sends.body.data as Array<{ id: string }>).some((own) => own.id === item.id),
      ),
    ).toBe(false);
  });

  async function conversationWithBody(
    token: string,
    conversations: Array<{ id: string }>,
    body: string,
  ): Promise<string> {
    for (const conversation of conversations) {
      const thread = await request(app.getHttpServer())
        .get(`/api/v1/admin/whatsapp/conversations/${conversation.id}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const found = (thread.body.data as Array<{ body: string }>).some(
        (message) => message.body === body,
      );
      if (found) {
        return conversation.id;
      }
    }
    throw new Error(`missing conversation with ${body}`);
  }

  function postWebhook(raw: string, signature: string) {
    return request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signature)
      .send(raw);
  }

  async function connect(
    token: string,
    phoneNumberId: string,
    phoneNumber: string,
  ): Promise<void> {
    await request(app.getHttpServer())
      .post('/api/v1/admin/whatsapp/connect')
      .set('Authorization', `Bearer ${token}`)
      .send({
        phoneNumber,
        businessAccountId: '102290129340398',
        phoneNumberId,
        accessToken,
      })
      .expect(200);
  }

  async function createProduct(token: string): Promise<string> {
    const category = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Pizzas' })
      .expect(201);
    const product = await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId: category.body.id,
        name: 'Margherita',
        priceCents: 3990,
        active: true,
        available: true,
      })
      .expect(201);
    return product.body.id as string;
  }

  async function openStore(token: string): Promise<void> {
    await request(app.getHttpServer())
      .put('/api/v1/admin/store/hours')
      .set('Authorization', `Bearer ${token}`)
      .send({
        hours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday,
          opensAt: '00:00:00',
          closesAt: '23:59:59',
          closed: false,
        })),
      })
      .expect(200);
  }

  async function createOwner(
    prefix: string,
    name: string,
  ): Promise<{ token: string; tenantSlug: string; tenantId: string }> {
    const admin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(200);
    const tenantSlug = `${prefix}-${randomBytes(4).toString('hex')}`;
    const tenant = await request(app.getHttpServer())
      .post('/api/v1/platform/tenants')
      .set('Authorization', `Bearer ${admin.body.accessToken as string}`)
      .send({
        name,
        slug: tenantSlug,
        phone: '11999999999',
        address: {
          line: 'Rua das Flores',
          number: '100',
          district: 'Centro',
          city: 'Sao Paulo',
          state: 'SP',
          postalCode: '01000-000',
        },
      })
      .expect(201);
    createdTenantIds.push(tenant.body.id as string);
    const email = `${prefix}-${randomBytes(3).toString('hex')}@example.com`;
    emails.push(email);
    await request(app.getHttpServer())
      .post(`/api/v1/platform/tenants/${tenant.body.id as string}/owner`)
      .set('Authorization', `Bearer ${admin.body.accessToken as string}`)
      .send({ name, email, password: 'OwnerPassword1' })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'OwnerPassword1' })
      .expect(200);
    return {
      token: login.body.accessToken as string,
      tenantSlug,
      tenantId: tenant.body.id as string,
    };
  }

  function postOrder(tenantSlug: string, productId: string, phone: string) {
    return request(app.getHttpServer())
      .post('/api/v1/public/orders')
      .set('X-Tenant-Host', `${tenantSlug}.localhost`)
      .set('Idempotency-Key', randomUUID())
      .send({
        customer: { name: 'Ana', phone },
        fulfillment: 'PICKUP',
        paymentMethodCode: 'CASH',
        notes: null,
        consents: {
          operational: true,
          marketing: false,
          policyVersion: '2026-10-02',
        },
        items: [{ productId, quantity: 1, optionIds: [], notes: null }],
      });
  }

  async function messagesFor(
    tenantId: string,
    templateKey: string,
  ): Promise<Array<{ event_id: string | null }>> {
    return app.get(DataSource).query(
      `SELECT event_id FROM whatsapp_messages
        WHERE tenant_id = ? AND template_key = ?`,
      [tenantId, templateKey],
    );
  }

  async function waitForMessage(
    tenantId: string,
    templateKey: string,
    status: string,
    timeoutMs = 15_000,
  ): Promise<{
    to_phone: string;
    provider_message_id: string | null;
    event_id: string | null;
  }> {
    const dataSource = app.get(DataSource);
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const rows = await dataSource.query(
        `SELECT to_phone, provider_message_id, event_id
           FROM whatsapp_messages
          WHERE tenant_id = ? AND template_key = ? AND status = ?`,
        [tenantId, templateKey, status],
      );
      if (rows.length > 0) {
        return rows[0];
      }
      await delay(50);
    }
    throw new Error(`missing ${status} ${templateKey} for ${tenantId}`);
  }

  async function waitForBody(
    tenantId: string,
    body: string,
    status: string,
  ): Promise<void> {
    const dataSource = app.get(DataSource);
    const started = Date.now();
    while (Date.now() - started < 15_000) {
      const rows = await dataSource.query(
        `SELECT id FROM whatsapp_messages
          WHERE tenant_id = ? AND body = ? AND status = ? AND direction = 'OUT'`,
        [tenantId, body, status],
      );
      if (rows.length === 1) {
        return;
      }
      await delay(50);
    }
    throw new Error(`missing outbound ${status} body for ${tenantId}`);
  }
});

function numericId(): string {
  return `${Date.now()}${randomBytes(2).readUInt16BE(0)}`.slice(0, 18);
}

function webhook(
  phoneNumberId: string,
  messageId: string,
  from: string,
  name: string | null,
  body: string,
): unknown {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: phoneNumberId },
              contacts:
                name === null ? [] : [{ wa_id: from, profile: { name } }],
              messages: [
                {
                  id: messageId,
                  from,
                  type: 'text',
                  text: { body },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clearRateLimits(): Promise<void> {
  const redis = new Redis({
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: Number(process.env['REDIS_PORT'] ?? '6379'),
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  await redis.connect();
  const keys = await redis.keys('auth:login:ip:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  redis.disconnect();
}
