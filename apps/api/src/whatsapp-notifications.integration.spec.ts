import { randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NotificationsWorkerModule } from '@ciadelivery/notifications/worker';
import { OutboxWorkerModule } from '@ciadelivery/orders/worker';
import { loadEnvFile, PlatformModule } from '@ciadelivery/shared';
import {
  NotifyOrderStatus,
  WhatsAppWorkerModule,
} from '@ciadelivery/whatsapp/worker';
import Redis from 'ioredis';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createApiApplication } from './bootstrap';

const envSnapshot = { ...process.env };
const adminEmail = 'platform-admin@ciadelivery.test';
const adminPassword = 'PlatformAdmin1';

describe('whatsapp order notifications', () => {
  jest.setTimeout(60_000);

  let app!: INestApplication;
  let worker!: INestApplication;
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
    app = await createApiApplication();
    await app.init();

    const moduleRef = await Test.createTestingModule({
      imports: [
        PlatformModule,
        NotificationsWorkerModule,
        WhatsAppWorkerModule,
        OutboxWorkerModule.register({ pollIntervalMs: 100 }),
      ],
    }).compile();
    worker = moduleRef.createNestApplication();
    await worker.init();
  });

  beforeEach(async () => {
    await clearRateLimits();
  });

  afterAll(async () => {
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
    if (worker !== undefined) {
      await worker.close();
    }
    await clearRateLimits();
    for (const key of Object.keys(process.env)) {
      if (!(key in envSnapshot)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, envSnapshot);
  });

  it('sends order_received once for the customer of that tenant', async () => {
    const ownerA = await createOwner('zap-msg-a', 'Pizzaria A');
    const ownerB = await createOwner('zap-msg-b', 'Pizzaria B');
    await connect(ownerA.token, '333000333');
    await openStore(ownerA.token);
    await openStore(ownerB.token);
    const productA = await createProduct(ownerA.token);
    const productB = await createProduct(ownerB.token);

    const created = await postOrder(ownerA.tenantSlug, productA, '11988887777').expect(201);
    const sent = await waitForMessage(ownerA.tenantId, 'order_received', 'SENT');
    expect(sent.to_phone).toBe('5511988887777');
    expect(sent.provider_message_id).toMatch(/^log-/);
    expect(String(sent.body)).toContain('Ana');
    expect(String(sent.body)).not.toContain('/pedido/');

    const foreign = await app.get(DataSource).query(
      `SELECT id FROM whatsapp_messages WHERE tenant_id = ?`,
      [ownerB.tenantId],
    );
    expect(foreign).toEqual([]);

    await request(app.getHttpServer())
      .patch('/api/v1/admin/whatsapp/templates/order_accepted')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ enabled: false })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${created.body.orderId as string}/accept`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);

    const skipped = await waitForMessage(ownerA.tenantId, 'order_accepted', 'SKIPPED');
    expect(skipped.last_error).toBe('TEMPLATE_DISABLED');
    const accepted = await app.get(DataSource).query(
      `SELECT status FROM orders WHERE id = ? AND tenant_id = ?`,
      [created.body.orderId, ownerA.tenantId],
    );
    expect(accepted[0].status).toBe('ACCEPTED');

    const quiet = await postOrder(ownerB.tenantSlug, productB, '11977776666').expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${quiet.body.orderId as string}/accept`)
      .set('Authorization', `Bearer ${ownerB.token}`)
      .expect(200);
    const quietMessage = await waitForMessage(
      ownerB.tenantId,
      'order_accepted',
      'SKIPPED',
    );
    expect(quietMessage.last_error).toBe('NO_CONNECTION');
    const stillAccepted = await app.get(DataSource).query(
      `SELECT status FROM orders WHERE id = ?`,
      [quiet.body.orderId],
    );
    expect(stillAccepted[0].status).toBe('ACCEPTED');
    const leaked = await app.get(DataSource).query(
      `SELECT id FROM whatsapp_messages WHERE tenant_id = ? AND to_phone LIKE ?`,
      [ownerA.tenantId, '%977776666'],
    );
    expect(leaked).toEqual([]);
  });

  it('sends order_accepted once even when the handler runs twice', async () => {
    const owner = await createOwner('zap-msg-once', 'Pizzaria Once');
    await connect(owner.token, '444000444');
    await openStore(owner.token);
    const productId = await createProduct(owner.token);
    const created = await postOrder(owner.tenantSlug, productId, '11966665555').expect(201);
    await waitForMessage(owner.tenantId, 'order_received', 'SENT');
    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${created.body.orderId as string}/accept`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    const first = await waitForMessage(owner.tenantId, 'order_accepted', 'SENT');
    const dataSource = app.get(DataSource);
    const events = await dataSource.query(
      `SELECT id FROM outbox_events WHERE aggregate_id = ? AND type = 'order.accepted'`,
      [created.body.orderId],
    );
    const notify = worker.get(NotifyOrderStatus);
    await notify.execute(events[0].id as string, 1);
    await notify.execute(events[0].id as string, 1);
    const rows = await dataSource.query(
      `SELECT id, provider_message_id FROM whatsapp_messages
        WHERE tenant_id = ? AND template_key = 'order_accepted' AND status = 'SENT'`,
      [owner.tenantId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].provider_message_id).toBe(first.provider_message_id);
  });

  async function connect(token: string, phoneNumberId: string): Promise<void> {
    await request(app.getHttpServer())
      .post('/api/v1/admin/whatsapp/connect')
      .set('Authorization', `Bearer ${token}`)
      .send({
        phoneNumber: '+5511988887777',
        businessAccountId: '102290129340398',
        phoneNumberId,
        accessToken: 'store-access-token-value',
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

  async function waitForMessage(
    tenantId: string,
    templateKey: string,
    status: string,
  ): Promise<{ to_phone: string; body: string; provider_message_id: string | null; last_error: string | null }> {
    const dataSource = app.get(DataSource);
    const started = Date.now();
    while (Date.now() - started < 15_000) {
      const rows = await dataSource.query(
        `SELECT to_phone, body, provider_message_id, last_error
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

});

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
