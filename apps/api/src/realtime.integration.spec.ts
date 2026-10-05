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

describe('realtime orders', () => {
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

  it('delivers order events only to authorized rooms', async () => {
    const ownerA = await createOwner('tempo-a', 'Tempo A');
    const ownerB = await createOwner('tempo-b', 'Tempo B');
    const productId = await createProduct(ownerA.token);
    await openStore(ownerA.token);

    const staff = connect({ auth: { token: ownerA.token } });
    const foreign = connect({ query: { token: ownerB.token } });
    await Promise.all([waitUntilConnected(staff), waitUntilConnected(foreign)]);
    staff.emit('join', `store:${randomUUID()}`);

    const foreignCreated: string[] = [];
    foreign.on('order.created', (payload: OrderEvent) => {
      foreignCreated.push(payload.orderId);
    });

    const created = await postOrder(ownerA.tenantSlug, productId);
    expect(created.status).toBe(201);
    const orderId = created.body.orderId as string;
    const orderNumber = created.body.orderNumber as number;
    const trackingToken = created.body.trackingToken as string;

    const createdEvent = await waitForOrderEvent(staff, 'order.created', orderId);
    expect(createdEvent).toEqual({
      orderId,
      status: 'NEW',
      orderNumber,
      occurredAt: expect.any(String),
    });
    expect(Object.keys(createdEvent).sort()).toEqual([
      'occurredAt',
      'orderId',
      'orderNumber',
      'status',
    ]);
    expect(foreignCreated.includes(orderId)).toBe(false);

    const listed = await request(app.getHttpServer())
      .get('/api/v1/admin/notifications')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    const notification = (
      listed.body.data as Array<{ id: string; orderId: string | null }>
    ).find((item) => item.orderId === orderId);
    expect(notification).toEqual(
      expect.objectContaining({
        orderId,
        type: 'order.created',
        title: `Novo pedido #${orderNumber}`,
        body: `Novo pedido #${orderNumber}`,
        readAt: null,
      }),
    );
    const foreignList = await request(app.getHttpServer())
      .get('/api/v1/admin/notifications')
      .set('Authorization', `Bearer ${ownerB.token}`)
      .expect(200);
    expect(
      (foreignList.body.data as Array<{ orderId: string | null }>).some(
        (item) => item.orderId === orderId,
      ),
    ).toBe(false);

    const trackingCreated: string[] = [];
    const tracking = connect({ auth: { trackingToken } });
    tracking.on('order.created', (payload: OrderEvent) => {
      trackingCreated.push(payload.orderId);
    });
    await waitUntilConnected(tracking);

    const accepted = await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${orderId}/accept`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    expect(accepted.body.status).toBe('ACCEPTED');
    const acceptedEvent = await waitForOrderEvent(tracking, 'order.accepted', orderId);
    expect(acceptedEvent.status).toBe('ACCEPTED');
    expect(acceptedEvent.orderNumber).toBe(orderNumber);

    const second = await postOrder(ownerA.tenantSlug, productId, '11977776666');
    expect(second.status).toBe(201);
    const secondId = second.body.orderId as string;
    await waitForOrderEvent(staff, 'order.created', secondId);
    expect(trackingCreated.includes(secondId)).toBe(false);

    const notificationId = notification?.id;
    expect(notificationId).toEqual(expect.any(String));
    const read = await request(app.getHttpServer())
      .post(`/api/v1/admin/notifications/${notificationId as string}/read`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    expect(read.body.readAt).toEqual(expect.any(String));
    const reread = await request(app.getHttpServer())
      .post(`/api/v1/admin/notifications/${notificationId as string}/read`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    expect(reread.body.readAt).toBe(read.body.readAt);
    const hidden = await request(app.getHttpServer())
      .post(`/api/v1/admin/notifications/${notificationId as string}/read`)
      .set('Authorization', `Bearer ${ownerB.token}`)
      .expect(404);
    expect(hidden.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
  });

  it('disconnects a socket that has no token', async () => {
    const socket = connect({});
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('the socket stayed open')),
        5_000,
      );
      socket.on('connect_error', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.on('connect', () => {
        clearTimeout(timer);
        reject(new Error('the socket connected'));
      });
    });
    expect(socket.connected).toBe(false);
  });

  function connect(options: {
    auth?: { token?: string; trackingToken?: string };
    query?: { token: string };
  }): Socket {
    const socket = io(realtimeUrl, {
      forceNew: true,
      reconnection: false,
      timeout: 5_000,
      ...(options.auth === undefined ? {} : { auth: options.auth }),
      ...(options.query === undefined ? {} : { query: options.query }),
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

  function postOrder(tenantSlug: string, productId: string, phone = '11988887777') {
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

function waitForOrderEvent(
  socket: Socket,
  event: 'order.created' | 'order.accepted',
  orderId: string,
): Promise<OrderEvent> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`missing ${event} for ${orderId}`));
    }, 10_000);
    const onEvent = (payload: OrderEvent) => {
      if (payload.orderId !== orderId) {
        return;
      }
      clearTimeout(timer);
      socket.off(event, onEvent);
      resolve(payload);
    };
    socket.on(event, onEvent);
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
