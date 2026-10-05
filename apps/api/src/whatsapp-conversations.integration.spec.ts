import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { loadEnvFile, PlatformModule } from '@ciadelivery/shared';
import { WHATSAPP } from '@ciadelivery/whatsapp';
import { WhatsAppWorkerModule } from '@ciadelivery/whatsapp/worker';
import Redis from 'ioredis';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createApiApplication } from './bootstrap';

const envSnapshot = { ...process.env };
const adminEmail = 'platform-admin@ciadelivery.test';
const adminPassword = 'PlatformAdmin1';
const appSecret = 'test-meta-app-secret';
const verifyToken = 'test-verify-token';
const accessToken = 'super-secret-token-value';

function sign(raw: string): string {
  return `sha256=${createHmac('sha256', appSecret).update(raw).digest('hex')}`;
}

describe('whatsapp conversations', () => {
  jest.setTimeout(60_000);

  let app!: INestApplication;
  let worker!: INestApplication;
  let realtimeUrl = '';
  const createdTenantIds: string[] = [];
  const emails: string[] = [];
  const sockets: Socket[] = [];

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
    await app.listen(0, '127.0.0.1');
    realtimeUrl = `http://127.0.0.1:${httpPort(app)}/realtime`;

    const moduleRef = await Test.createTestingModule({
      imports: [PlatformModule, WhatsAppWorkerModule],
    }).compile();
    worker = moduleRef.createNestApplication();
    await worker.init();
  });

  beforeEach(async () => {
    await clearRateLimits();
  });

  afterAll(async () => {
    for (const socket of sockets) {
      socket.close();
    }
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
          `DELETE FROM orders WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM customers WHERE tenant_id IN (${marks})`,
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
      await clearRateLimits();
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    }

    for (const key of Object.keys(process.env)) {
      if (!(key in envSnapshot)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, envSnapshot);
  });

  it('opens one conversation for a signed webhook and hides it from another tenant', async () => {
    const ownerA = await createOwner('talk-a', 'Talk A');
    const ownerB = await createOwner('talk-b', 'Talk B');
    const phoneNumberId = String(Date.now()) + String(randomBytes(2).readUInt16BE(0));
    await connect(ownerA.token, phoneNumberId);
    const linked = await seedCustomerAndOrder(ownerA.tenantId);

    const kitchenEmail = `kitchen-${randomBytes(3).toString('hex')}@example.com`;
    emails.push(kitchenEmail);
    await request(app.getHttpServer())
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({
        name: 'Cozinha',
        email: kitchenEmail,
        password: 'KitchenPassword1',
        role: 'KITCHEN',
      })
      .expect(201);
    const kitchenLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: kitchenEmail, password: 'KitchenPassword1' })
      .expect(200);

    const ownerSocket = connectSocket(ownerA.token);
    const kitchenSocket = connectSocket(kitchenLogin.body.accessToken as string);
    await waitUntilConnected(ownerSocket);
    await waitUntilConnected(kitchenSocket);
    const ownerEvents: Array<Record<string, string>> = [];
    const kitchenEvents: unknown[] = [];
    ownerSocket.on('conversation.message_received', (payload: Record<string, string>) => {
      ownerEvents.push(payload);
    });
    kitchenSocket.on('conversation.message_received', (payload: unknown) => {
      kitchenEvents.push(payload);
    });

    const wamid = `wamid.${randomBytes(6).toString('hex')}`;
    const raw = JSON.stringify(
      webhook(phoneNumberId, wamid, '5511999991234', 'Ana', 'oi #99 e #42'),
    );
    await postWebhook(raw, sign(raw)).expect(200);
    await postWebhook(raw, sign(raw)).expect(200);

    const dataSource = app.get(DataSource);
    const messages = await dataSource.query(
      `SELECT direction, author, external_id, body
         FROM whatsapp_messages
        WHERE external_id = ?`,
      [wamid],
    );
    expect(messages).toEqual([
      {
        direction: 'IN',
        author: 'CUSTOMER',
        external_id: wamid,
        body: 'oi #99 e #42',
      },
    ]);
    const conversations = await dataSource.query(
      `SELECT customer_id, linked_order_id, mode, contact_phone
         FROM conversations
        WHERE tenant_id = ? AND contact_phone = ?`,
      [ownerA.tenantId, '5511999991234'],
    );
    expect(conversations).toEqual([
      {
        customer_id: linked.customerId,
        linked_order_id: linked.orderId,
        mode: 'HUMAN',
        contact_phone: '5511999991234',
      },
    ]);

    const listed = await request(app.getHttpServer())
      .get('/api/v1/admin/whatsapp/conversations')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    expect(listed.body.data).toEqual([
      expect.objectContaining({
        maskedPhone: '*********1234',
        mode: 'HUMAN',
      }),
    ]);
    expect(JSON.stringify(listed.body)).not.toContain('5511999991234');
    const conversationId = listed.body.data[0].id as string;
    const thread = await request(app.getHttpServer())
      .get(`/api/v1/admin/whatsapp/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    expect(thread.body.conversation.contactPhone).toBe('5511999991234');

    const foreign = await request(app.getHttpServer())
      .get('/api/v1/admin/whatsapp/conversations')
      .set('Authorization', `Bearer ${ownerB.token}`)
      .expect(200);
    expect(foreign.body.data).toEqual([]);
    const hidden = await request(app.getHttpServer())
      .get(`/api/v1/admin/whatsapp/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${ownerB.token}`)
      .expect(404);
    expect(hidden.body.error.code).toBe('CONVERSATION_NOT_FOUND');

    await waitFor(() => ownerEvents.length > 0);
    await delay(300);
    expect(kitchenEvents).toEqual([]);
    expect(ownerEvents[0]).toEqual(
      expect.objectContaining({
        conversationId,
        author: 'CUSTOMER',
        direction: 'IN',
        body: 'oi #99 e #42',
      }),
    );
    expect(JSON.stringify(ownerEvents[0])).not.toContain(accessToken);
  });

  it('queues one logged reply and refuses a store that is disconnected', async () => {
    const owner = await createOwner('talk-reply', 'Talk Reply');
    const phoneNumberId = String(Date.now()) + String(randomBytes(2).readUInt16BE(0));
    await connect(owner.token, phoneNumberId);
    const wamid = `wamid.${randomBytes(6).toString('hex')}`;
    const raw = JSON.stringify(
      webhook(phoneNumberId, wamid, '5511888777666', null, 'alô'),
    );
    await postWebhook(raw, sign(raw)).expect(200);
    const listed = await request(app.getHttpServer())
      .get('/api/v1/admin/whatsapp/conversations')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    const conversationId = listed.body.data[0].id as string;

    const provider = worker.get(WHATSAPP) as {
      outbox: Array<{ kind: string; to: string }>;
    };
    const before = provider.outbox.filter((item) => item.kind === 'text').length;
    const sent = await request(app.getHttpServer())
      .post(`/api/v1/admin/whatsapp/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ body: 'pode retirar' })
      .expect(201);
    expect(sent.body).toEqual(
      expect.objectContaining({
        direction: 'OUT',
        author: 'USER',
        body: 'pode retirar',
        status: 'QUEUED',
      }),
    );

    await waitForMessage(owner.tenantId, 'pode retirar');
    const texts = provider.outbox.filter(
      (item) => item.kind === 'text' && item.to === '5511888777666',
    );
    expect(texts).toHaveLength(1);
    expect(provider.outbox.filter((item) => item.kind === 'text').length).toBe(
      before + 1,
    );

    await request(app.getHttpServer())
      .delete('/api/v1/admin/whatsapp/connection')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(204);
    const blocked = await request(app.getHttpServer())
      .post(`/api/v1/admin/whatsapp/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ body: 'de novo' })
      .expect(409);
    expect(blocked.body.error.code).toBe('WHATSAPP_NOT_CONNECTED');
  });

  function postWebhook(raw: string, signature: string) {
    return request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signature)
      .send(raw);
  }

  async function connect(token: string, phoneNumberId: string): Promise<void> {
    await request(app.getHttpServer())
      .post('/api/v1/admin/whatsapp/connect')
      .set('Authorization', `Bearer ${token}`)
      .send({
        phoneNumber: '+5511977776666',
        businessAccountId: '102290129340398',
        phoneNumberId,
        accessToken,
      })
      .expect(200);
  }

  async function seedCustomerAndOrder(tenantId: string): Promise<{
    customerId: string;
    orderId: string;
  }> {
    const dataSource = app.get(DataSource);
    const stores: Array<{ id: string }> = await dataSource.query(
      'SELECT id FROM stores WHERE tenant_id = ? LIMIT 1',
      [tenantId],
    );
    const storeId = stores[0]?.id;
    if (storeId === undefined) {
      throw new Error('missing store');
    }
    const customerId = randomUUID();
    const orderId = randomUUID();
    const now = new Date();
    await dataSource.query(
      `INSERT INTO customers (id, tenant_id, store_id, name, phone, created_at, updated_at)
       VALUES (?, ?, ?, 'Ana', '5511999991234', ?, ?)`,
      [customerId, tenantId, storeId, now, now],
    );
    await dataSource.query(
      `INSERT INTO orders (
         id, tenant_id, store_id, customer_id, order_number, status, fulfillment,
         payment_method_code, payment_label, customer_name, customer_phone,
         subtotal_cents, delivery_fee_cents, total_cents, tracking_token_hash,
         idempotency_key, created_at, updated_at
       ) VALUES (?, ?, ?, ?, 42, 'NEW', 'PICKUP', 'CASH', 'Dinheiro', 'Ana', '5511999991234',
                 1000, 0, 1000, ?, ?, ?, ?)`,
      [
        orderId,
        tenantId,
        storeId,
        customerId,
        randomBytes(32).toString('hex'),
        `idem-${randomUUID()}`,
        now,
        now,
      ],
    );
    return { customerId, orderId };
  }

  async function createOwner(
    prefix: string,
    name: string,
  ): Promise<{ token: string; tenantId: string }> {
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
      tenantId: tenant.body.id as string,
    };
  }

  function connectSocket(token: string): Socket {
    const socket = io(realtimeUrl, {
      forceNew: true,
      reconnection: false,
      timeout: 5_000,
      auth: { token },
    });
    sockets.push(socket);
    return socket;
  }

  async function waitForMessage(tenantId: string, body: string): Promise<void> {
    const dataSource = app.get(DataSource);
    await waitFor(async () => {
      const rows: Array<{ status: string; provider_message_id: string | null }> =
        await dataSource.query(
          `SELECT status, provider_message_id
             FROM whatsapp_messages
            WHERE tenant_id = ? AND body = ? AND direction = 'OUT'`,
          [tenantId, body],
        );
      return (
        rows.length === 1 &&
        rows[0]?.status === 'SENT' &&
        typeof rows[0].provider_message_id === 'string' &&
        rows[0].provider_message_id.startsWith('log-')
      );
    });
  }
});

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
                name === null
                  ? []
                  : [{ wa_id: from, profile: { name } }],
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

function httpPort(app: INestApplication): number {
  const address = app.getHttpServer().address();
  if (address === null || typeof address === 'string') {
    throw new Error('The API is not listening');
  }
  return address.port;
}

function waitUntilConnected(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('the realtime socket did not connect')),
      5_000,
    );
    if (socket.connected) {
      clearTimeout(timer);
      resolve();
      return;
    }
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.on('connect_error', (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function waitFor(ready: () => boolean | Promise<boolean>): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 15_000) {
    if (await ready()) {
      return;
    }
    await delay(50);
  }
  throw new Error('the conversation update did not arrive');
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
  const keys = await redis.keys('auth:login:ip:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  redis.disconnect();
}
