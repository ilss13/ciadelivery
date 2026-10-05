import { randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NotificationsWorkerModule } from '@ciadelivery/notifications/worker';
import { OutboxWorkerModule } from '@ciadelivery/orders/worker';
import { loadEnvFile, PlatformModule } from '@ciadelivery/shared';
import Redis from 'ioredis';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createApiApplication } from './bootstrap';

const envSnapshot = { ...process.env };
const adminEmail = 'platform-admin@ciadelivery.test';
const adminPassword = 'PlatformAdmin1';

interface OrderEvent {
  orderId: string;
  status: string;
  orderNumber: number;
  occurredAt: string;
}

const CUSTOMER_EVENTS = [
  'order.accepted',
  'order.in_preparation',
  'order.ready',
] as const;

describe('phase 4 acceptance', () => {
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
    app = await createApiApplication();
    await app.init();
    await app.listen(0, '127.0.0.1');
    realtimeUrl = `http://127.0.0.1:${httpPort(app)}/realtime`;

    const moduleRef = await Test.createTestingModule({
      imports: [
        PlatformModule,
        NotificationsWorkerModule,
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
    for (const socket of sockets) {
      socket.close();
    }
    if (app !== undefined) {
      const dataSource = app.get(DataSource);
      if (dataSource.isInitialized && createdTenantIds.length > 0) {
        const marks = createdTenantIds.map(() => '?').join(', ');
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
          `DELETE FROM payment_methods WHERE tenant_id IN (${marks})`,
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
    }

    const workerData = worker === undefined ? undefined : worker.get(DataSource);
    if (worker !== undefined) {
      await worker.close();
    }
    if (app !== undefined) {
      const apiData = app.get(DataSource);
      await app.close();
      if (apiData.isInitialized) {
        await apiData.destroy();
      }
    }
    if (workerData?.isInitialized) {
      await workerData.destroy();
    }
    await clearRateLimits();
    for (const key of Object.keys(process.env)) {
      if (!(key in envSnapshot)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, envSnapshot);
  });

  it('shows a new order to the store and each status change to the customer', async () => {
    const ownerA = await createOwner('fase4-a', 'Fase 4 A');
    const ownerB = await createOwner('fase4-b', 'Fase 4 B');
    const productId = await createProduct(ownerA.token);
    await openStore(ownerA.token);

    const staff = connect({ auth: { token: ownerA.token } });
    const foreign = connect({ auth: { token: ownerB.token } });
    await Promise.all([waitUntilConnected(staff), waitUntilConnected(foreign)]);

    const createdEvents: OrderEvent[] = [];
    const foreignEvents: OrderEvent[] = [];
    staff.on('order.created', (payload: OrderEvent) => {
      createdEvents.push(payload);
    });
    for (const name of [
      'order.created',
      'order.updated',
      'order.accepted',
      'order.rejected',
      'order.in_preparation',
      'order.ready',
      'order.delivered',
      'order.cancelled',
    ]) {
      foreign.on(name, (payload: OrderEvent) => {
        foreignEvents.push(payload);
      });
    }

    const created = await postOrder(ownerA.tenantSlug, productId);
    expect(created.status).toBe(201);
    const orderId = created.body.orderId as string;
    const orderNumber = created.body.orderNumber as number;
    const trackingToken = created.body.trackingToken as string;

    const createdEvent = await waitForCollected(
      createdEvents,
      (event) => event.orderId === orderId,
      'order.created',
    );
    expect(createdEvent).toEqual({
      orderId,
      status: 'NEW',
      orderNumber,
      occurredAt: expect.any(String),
    });

    const customerEvents: string[] = [];
    const customer = connect({ auth: { trackingToken } });
    for (const name of CUSTOMER_EVENTS) {
      customer.on(name, (payload: OrderEvent) => {
        if (payload.orderId === orderId) {
          customerEvents.push(name);
        }
      });
    }
    await waitUntilConnected(customer);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${orderId}/accept`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    await waitForCollected(
      customerEvents,
      (name) => name === 'order.accepted',
      'order.accepted',
    );

    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${orderId}/start-preparation`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    await waitForCollected(
      customerEvents,
      (name) => name === 'order.in_preparation',
      'order.in_preparation',
    );

    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${orderId}/ready`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    await waitForCollected(
      customerEvents,
      (name) => name === 'order.ready',
      'order.ready',
    );

    expect(customerEvents).toEqual([
      'order.accepted',
      'order.in_preparation',
      'order.ready',
    ]);
    expect(foreignEvents).toEqual([]);

    const loaded = await request(app.getHttpServer())
      .get(`/api/v1/public/orders/${trackingToken}`)
      .expect(200);
    expect(loaded.body.status).toBe('READY');
    expect(loaded.body.history).toEqual([
      expect.objectContaining({
        toStatus: 'NEW',
        actorType: 'CUSTOMER',
        note: null,
      }),
      expect.objectContaining({
        toStatus: 'ACCEPTED',
        actorType: 'USER',
        note: null,
      }),
      expect.objectContaining({
        toStatus: 'IN_PREPARATION',
        actorType: 'USER',
        note: null,
      }),
      expect.objectContaining({
        toStatus: 'READY',
        actorType: 'USER',
        note: null,
      }),
    ]);
    expect(JSON.stringify(loaded.body.history)).not.toContain('actorId');
  });

  function connect(options: {
    auth: { token?: string; trackingToken?: string };
  }): Socket {
    const socket = io(realtimeUrl, {
      forceNew: true,
      reconnection: false,
      timeout: 5_000,
      auth: options.auth,
    });
    sockets.push(socket);
    return socket;
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
  ): Promise<{ token: string; tenantSlug: string }> {
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
    };
  }

  function postOrder(tenantSlug: string, productId: string) {
    return request(app.getHttpServer())
      .post('/api/v1/public/orders')
      .set('X-Tenant-Host', `${tenantSlug}.localhost`)
      .set('Idempotency-Key', randomUUID())
      .send({
        customer: { name: 'Ana', phone: '11988887777' },
        fulfillment: 'PICKUP',
        paymentMethodCode: 'CASH',
        notes: null,
        consents: {
          operational: true,
          marketing: false,
          policyVersion: '2026-10-02',
        },
        items: [
          {
            productId,
            quantity: 1,
            optionIds: [],
            notes: null,
          },
        ],
      });
  }
});

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

function waitForCollected<T>(
  items: readonly T[],
  matches: (item: T) => boolean,
  label: string,
): Promise<T> {
  const found = items.find(matches);
  if (found !== undefined) {
    return Promise.resolve(found);
  }
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const match = items.find(matches);
      if (match !== undefined) {
        clearInterval(timer);
        resolve(match);
        return;
      }
      if (Date.now() - started >= 5_000) {
        clearInterval(timer);
        reject(new Error(`missing ${label} within 5 seconds`));
      }
    }, 50);
  });
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
