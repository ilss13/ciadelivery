import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { loadEnvFile, PlatformModule } from '@ciadelivery/shared';
import {
  CONVERSATION_TOOLS,
  CONVERSATION_ORDERS,
  ConversationOrders,
  ConversationTools,
  WHATSAPP,
} from '@ciadelivery/whatsapp';
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
          `DELETE FROM order_previews WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
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

    const defaults = await request(app.getHttpServer())
      .get('/api/v1/admin/whatsapp/ai')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    expect(defaults.body).toEqual({
      aiEnabled: false,
      aiAutoReply: false,
    });
    await request(app.getHttpServer())
      .put('/api/v1/admin/whatsapp/ai')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ aiEnabled: true, aiAutoReply: false })
      .expect(200);
    const foreignMode = await request(app.getHttpServer())
      .post(`/api/v1/admin/whatsapp/conversations/${conversationId}/mode`)
      .set('Authorization', `Bearer ${ownerB.token}`)
      .send({ mode: 'BOT' })
      .expect(404);
    expect(foreignMode.body.error.code).toBe('CONVERSATION_NOT_FOUND');
    const botMode = await request(app.getHttpServer())
      .post(`/api/v1/admin/whatsapp/conversations/${conversationId}/mode`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ mode: 'BOT' })
      .expect(200);
    expect(botMode.body.mode).toBe('BOT');

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

  it('hands a bot conversation to a person when no LLM endpoint is configured', async () => {
    const owner = await createOwner('talk-no-llm', 'Talk No LLM');
    const phoneNumberId = String(Date.now()) + String(randomBytes(2).readUInt16BE(0));
    await connect(owner.token, phoneNumberId);
    const firstId = `wamid.${randomBytes(6).toString('hex')}`;
    const first = JSON.stringify(
      webhook(phoneNumberId, firstId, '5511777666555', null, 'olá'),
    );
    await postWebhook(first, sign(first)).expect(200);
    const listed = await request(app.getHttpServer())
      .get('/api/v1/admin/whatsapp/conversations')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    const conversationId = listed.body.data[0].id as string;
    await request(app.getHttpServer())
      .put('/api/v1/admin/whatsapp/ai')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ aiEnabled: true, aiAutoReply: false })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/whatsapp/conversations/${conversationId}/mode`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ mode: 'BOT' })
      .expect(200);

    const nextId = `wamid.${randomBytes(6).toString('hex')}`;
    const next = JSON.stringify(
      webhook(phoneNumberId, nextId, '5511777666555', null, 'vocês abrem hoje?'),
    );
    await postWebhook(next, sign(next)).expect(200);
    const dataSource = app.get(DataSource);
    await waitFor(async () => {
      const rows: Array<{ mode: string }> = await dataSource.query(
        'SELECT mode FROM conversations WHERE tenant_id = ? AND id = ?',
        [owner.tenantId, conversationId],
      );
      return rows[0]?.mode === 'HUMAN';
    });
    const turns = await dataSource.query(
      `SELECT confidence, outcome, prompt_hash
         FROM ai_turns
        WHERE tenant_id = ? AND conversation_id = ?`,
      [owner.tenantId, conversationId],
    );
    expect(turns).toEqual([
      expect.objectContaining({
        confidence: '0.0000',
        outcome: 'HANDOFF',
        prompt_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    ]);
    await waitForMessage(
      owner.tenantId,
      'Vou chamar uma pessoa da equipe para continuar seu atendimento.',
    );
  });

  it('builds an isolated server-priced preview and refuses unavailable or out-of-area items', async () => {
    const ownerA = await createOwner('tools-a', 'Tools A');
    const ownerB = await createOwner('tools-b', 'Tools B');
    await openStore(ownerA.token);
    const productA = await createProduct(ownerA.token, 'X-Bacon', 2000, true);
    const unavailable = await createProduct(
      ownerA.token,
      'X-Salada indisponível',
      1800,
      false,
    );
    await createProduct(ownerB.token, 'X-Bacon secreto', 9900, true);
    const dataSource = app.get(DataSource);
    const stores: Array<{ id: string }> = await dataSource.query(
      'SELECT id FROM stores WHERE tenant_id = ? LIMIT 1',
      [ownerA.tenantId],
    );
    const storeId = stores[0]?.id;
    if (storeId === undefined) {
      throw new Error('missing store');
    }
    const conversationId = randomUUID();
    const now = new Date();
    await dataSource.query(
      `INSERT INTO conversations (
         id, tenant_id, store_id, customer_id, contact_phone, contact_name,
         mode, linked_order_id, last_message_at, created_at, updated_at
       ) VALUES (?, ?, ?, NULL, '5511999991234', 'Ana', 'BOT', NULL, ?, ?, ?)`,
      [conversationId, ownerA.tenantId, storeId, now, now, now],
    );
    const tools = app.get<ConversationTools>(CONVERSATION_TOOLS);
    const context = {
      tenantId: ownerA.tenantId,
      storeId,
      conversationId,
      contactPhone: '5511999991234',
    };

    const searched = await tools.execute(context, {
      id: 'search',
      name: 'search_catalog',
      arguments: { query: 'X-Bacon' },
    });
    expect(searched).toEqual({
      ok: true,
      products: [
        expect.objectContaining({
          id: productA,
          name: 'X-Bacon',
          priceCents: 2000,
        }),
      ],
    });
    expect(JSON.stringify(searched)).not.toContain('X-Bacon secreto');

    const preview = await tools.execute(context, {
      id: 'preview',
      name: 'preview_order',
      arguments: {
        items: [
          { productId: productA, quantity: 2, optionIds: [], notes: null },
        ],
        fulfillment: 'PICKUP',
        phone: '5511000000000',
        name: 'Ana',
      },
    });
    expect(preview).toEqual(
      expect.objectContaining({
        ok: true,
        subtotalCents: 4000,
        deliveryFeeCents: 0,
        totalCents: 4000,
        previewToken: expect.any(String),
      }),
    );
    const persisted: Array<{ payload: string | object }> = await dataSource.query(
      `SELECT payload FROM order_previews
        WHERE tenant_id = ? AND conversation_id = ? AND invalidated_at IS NULL`,
      [ownerA.tenantId, conversationId],
    );
    expect(persisted).toHaveLength(1);
    expect(JSON.stringify(persisted[0]?.payload)).toContain('5511999991234');
    expect(JSON.stringify(persisted[0]?.payload)).not.toContain('5511000000000');

    const blocked = await tools.execute(context, {
      id: 'unavailable',
      name: 'preview_order',
      arguments: {
        items: [
          { productId: unavailable, quantity: 1, optionIds: [], notes: null },
        ],
        fulfillment: 'PICKUP',
        phone: '5511999991234',
        name: 'Ana',
      },
    });
    expect(blocked).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ code: 'PRODUCT_UNAVAILABLE' }),
      }),
    );

    const outside = await tools.execute(context, {
      id: 'outside',
      name: 'preview_order',
      arguments: {
        items: [
          { productId: productA, quantity: 1, optionIds: [], notes: null },
        ],
        fulfillment: 'DELIVERY',
        address: {
          line: 'Rua Longe',
          number: '900',
          district: 'Centro',
          city: 'Sao Paulo',
          state: 'SP',
          postalCode: '99999999',
        },
        phone: '5511999991234',
        name: 'Ana',
      },
    });
    expect(outside).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ code: 'OUT_OF_AREA' }),
      }),
    );
    const previews: Array<{ total: number | string }> = await dataSource.query(
      `SELECT COUNT(*) AS total FROM order_previews
        WHERE tenant_id = ? AND conversation_id = ?`,
      [ownerA.tenantId, conversationId],
    );
    expect(Number(previews[0]?.total)).toBe(1);

    const orders = app.get<ConversationOrders>(CONVERSATION_ORDERS);
    const confirmed = await orders.confirm({
      ...context,
      contactName: 'Ana',
    });
    expect(confirmed).toEqual(
      expect.objectContaining({
        outcome: 'CREATED',
        orderNumber: expect.any(Number),
        trackingPath: expect.stringMatching(/^\/pedido\//),
      }),
    );
    const created: Array<{
      id: string;
      source: string;
      status: string;
      total_cents: number | string;
      customer_phone: string;
    }> = await dataSource.query(
      `SELECT id, source, status, total_cents, customer_phone
         FROM orders
        WHERE tenant_id = ? AND store_id = ? AND customer_phone = ?`,
      [ownerA.tenantId, storeId, '5511999991234'],
    );
    expect(created).toHaveLength(1);
    expect(created[0]).toEqual(
      expect.objectContaining({
        source: 'WHATSAPP',
        status: 'NEW',
        total_cents: 4000,
        customer_phone: '5511999991234',
      }),
    );
    const items: Array<{
      quantity: number | string;
      unit_price_cents: number | string;
    }> = await dataSource.query(
      `SELECT quantity, unit_price_cents
         FROM order_items
        WHERE tenant_id = ? AND order_id = ?`,
      [ownerA.tenantId, created[0]?.id],
    );
    expect(items).toEqual([{ quantity: 2, unit_price_cents: 2000 }]);
    const linked: Array<{ linked_order_id: string; mode: string }> =
      await dataSource.query(
        `SELECT linked_order_id, mode
           FROM conversations
          WHERE tenant_id = ? AND store_id = ? AND id = ?`,
        [ownerA.tenantId, storeId, conversationId],
      );
    expect(linked).toEqual([
      { linked_order_id: created[0]?.id, mode: 'HUMAN' },
    ]);

    const changedConversationId = randomUUID();
    await dataSource.query(
      `INSERT INTO conversations (
         id, tenant_id, store_id, customer_id, contact_phone, contact_name,
         mode, linked_order_id, last_message_at, created_at, updated_at
       ) VALUES (?, ?, ?, NULL, '5511999995678', 'Bia', 'BOT', NULL, ?, ?, ?)`,
      [changedConversationId, ownerA.tenantId, storeId, now, now, now],
    );
    const changedContext = {
      ...context,
      conversationId: changedConversationId,
      contactPhone: '5511999995678',
    };
    await tools.execute(changedContext, {
      id: 'changed-preview',
      name: 'preview_order',
      arguments: {
        items: [
          { productId: productA, quantity: 2, optionIds: [], notes: null },
        ],
        fulfillment: 'PICKUP',
        phone: '5511999995678',
        name: 'Bia',
      },
    });
    await dataSource.query(
      `UPDATE products SET price_cents = 2500
        WHERE tenant_id = ? AND store_id = ? AND id = ?`,
      [ownerA.tenantId, storeId, productA],
    );
    const changed = await orders.confirm({
      ...changedContext,
      contactName: 'Bia',
    });
    expect(changed).toEqual(
      expect.objectContaining({
        outcome: 'PRICE_CHANGED',
        preview: expect.objectContaining({ totalCents: 5000 }),
      }),
    );
    const changedOrders: Array<{ total: number | string }> =
      await dataSource.query(
        `SELECT COUNT(*) AS total FROM orders
          WHERE tenant_id = ? AND customer_phone = '5511999995678'`,
        [ownerA.tenantId],
      );
    expect(Number(changedOrders[0]?.total)).toBe(0);
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

  async function createProduct(
    token: string,
    name: string,
    priceCents: number,
    available: boolean,
  ): Promise<string> {
    const category = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Lanches ${randomBytes(3).toString('hex')}` })
      .expect(201);
    const product = await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId: category.body.id,
        name,
        priceCents,
        active: true,
        available,
      })
      .expect(201);
    return product.body.id as string;
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
