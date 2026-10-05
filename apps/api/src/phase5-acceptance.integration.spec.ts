import { randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NotificationsWorkerModule } from '@ciadelivery/notifications/worker';
import { OutboxWorkerModule } from '@ciadelivery/orders/worker';
import {
  GEOCODING,
  GeocodingProvider,
  isStubGeocoding,
  loadEnvFile,
  PlatformModule,
} from '@ciadelivery/shared';
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

const bands = [
  { fromKm: 0, toKm: 3, feeCents: 500 },
  { fromKm: 3, toKm: 5, feeCents: 700 },
  { fromKm: 5, toKm: 8, feeCents: 1000 },
];

describe('phase 5 acceptance', () => {
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
          `DELETE FROM delivery_assignments WHERE tenant_id IN (${marks})`,
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
          `DELETE FROM couriers WHERE tenant_id IN (${marks})`,
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

  it('blocks an address outside the radius and finishes the delivery cycle', async () => {
    const geocoding = app.get<GeocodingProvider>(GEOCODING);
    if (!isStubGeocoding(geocoding)) {
      throw new Error('Expected the stub geocoding provider');
    }
    geocoding.clear();

    const owner = await createOwner('fase5', 'Fase 5');
    const productId = await createProduct(owner.token);
    await openStore(owner.token);
    const dataSource = app.get(DataSource);
    const config = await request(app.getHttpServer())
      .get('/api/v1/admin/delivery/config')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    const originLatitude = Number(config.body.originLatitude);
    const originLongitude = Number(config.body.originLongitude);
    const near = {
      latitude: originLatitude + 2 / 111.195,
      longitude: originLongitude,
    };
    const far = {
      latitude: originLatitude + 9 / 111.195,
      longitude: originLongitude,
    };
    const nearAddress = { ...deliveryAddress(), line: 'Rua Perto', number: '20' };
    const farAddress = { ...deliveryAddress(), line: 'Rua Longe', number: '900' };
    geocoding.register(nearAddress, near);
    geocoding.register(farAddress, far);

    await request(app.getHttpServer())
      .put('/api/v1/admin/delivery/config')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        deliveryEnabled: true,
        pickupEnabled: true,
        maxRadiusKm: 8,
        feeMode: 'ZONE',
        flatFeeCents: 0,
        estimatedMinutes: 40,
        zones: bands,
      })
      .expect(200);

    const refused = await request(app.getHttpServer())
      .post('/api/v1/public/delivery/quote')
      .set('X-Tenant-Host', `${owner.tenantSlug}.localhost`)
      .send({ fulfillment: 'DELIVERY', address: farAddress })
      .expect(200);
    expect(refused.body).toEqual(
      expect.objectContaining({
        accepted: false,
        reason: 'OUT_OF_AREA',
        feeCents: 0,
      }),
    );
    expect(refused.body.distanceKm).toBeGreaterThan(8);

    const ordersBefore = await countOrders(dataSource, owner.tenantId);
    const blocked = await postOrder(owner.tenantSlug, productId, farAddress);
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.code).toBe('OUT_OF_AREA');
    expect(await countOrders(dataSource, owner.tenantId)).toBe(ordersBefore);

    const created = await postOrder(owner.tenantSlug, productId, nearAddress);
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('NEW');
    expect(created.body.totalCents).toBe(4490);
    const orderId = created.body.orderId as string;
    const trackingToken = created.body.trackingToken as string;

    const quoted = await request(app.getHttpServer())
      .get(`/api/v1/public/orders/${trackingToken}`)
      .expect(200);
    expect(quoted.body.deliveryFeeCents).toBe(500);
    expect(quoted.body.status).toBe('NEW');

    for (const step of ['accept', 'start-preparation', 'ready'] as const) {
      await request(app.getHttpServer())
        .post(`/api/v1/admin/orders/${orderId}/${step}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
    }

    const password = 'CourierPassword1';
    const first = await createCourier(owner.token, 'Lia', password);
    const second = await createCourier(owner.token, 'Caio', 'CourierPassword2');
    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${orderId}/assign-courier`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ courierId: first.body.id })
      .expect(200);

    const customerEvents: OrderEvent[] = [];
    const customer = connect({ auth: { trackingToken } });
    customer.on('order.out_for_delivery', (payload: OrderEvent) => {
      customerEvents.push(payload);
    });
    customer.on('order.delivered', (payload: OrderEvent) => {
      customerEvents.push(payload);
    });
    await waitUntilConnected(customer);

    const courierA = await login(first.body.email as string, password);
    const courierB = await login(second.body.email as string, 'CourierPassword2');
    const started = await request(app.getHttpServer())
      .post(`/api/v1/courier/orders/${orderId}/start`)
      .set('Authorization', `Bearer ${courierA}`)
      .expect(200);
    expect(started.body.status).toBe('OUT_FOR_DELIVERY');

    const departed = await waitForCollected(
      customerEvents,
      (event) => event.orderId === orderId && event.status === 'OUT_FOR_DELIVERY',
      'order.out_for_delivery',
    );
    expect(departed.orderNumber).toBe(created.body.orderNumber);

    const historyAfterStart = await statuses(dataSource, orderId);
    expect(historyAfterStart).toContain('OUT_FOR_DELIVERY');
    const eventsAfterStart = await eventTypes(dataSource, orderId);
    expect(eventsAfterStart).toContain('order.out_for_delivery');

    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ note: 'Cliente sumiu' })
      .expect(409);
    expect(cancelled.body.error.code).toBe('ORDER_INVALID_TRANSITION');

    const stolen = await request(app.getHttpServer())
      .post(`/api/v1/courier/orders/${orderId}/complete`)
      .set('Authorization', `Bearer ${courierB}`)
      .expect(404);
    expect(stolen.body.error.code).toBe('ORDER_NOT_FOUND');

    const completed = await request(app.getHttpServer())
      .post(`/api/v1/courier/orders/${orderId}/complete`)
      .set('Authorization', `Bearer ${courierA}`)
      .expect(200);
    expect(completed.body.status).toBe('DELIVERED');

    await waitForCollected(
      customerEvents,
      (event) => event.orderId === orderId && event.status === 'DELIVERED',
      'order.delivered',
    );

    const assignment: Array<{ status: string }> = await dataSource.query(
      `SELECT status FROM delivery_assignments WHERE order_id = ?`,
      [orderId],
    );
    expect(assignment[0]?.status).toBe('DELIVERED');
    expect(await statuses(dataSource, orderId)).toEqual([
      'NEW',
      'ACCEPTED',
      'IN_PREPARATION',
      'READY',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
    ]);
    expect(await eventTypes(dataSource, orderId)).toEqual(
      expect.arrayContaining(['order.out_for_delivery', 'order.delivered']),
    );

    const loaded = await request(app.getHttpServer())
      .get(`/api/v1/public/orders/${trackingToken}`)
      .expect(200);
    expect(loaded.body.status).toBe('DELIVERED');
    expect(loaded.body.history.map((entry: { toStatus: string }) => entry.toStatus)).toEqual([
      'NEW',
      'ACCEPTED',
      'IN_PREPARATION',
      'READY',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
    ]);

    const again = await request(app.getHttpServer())
      .post(`/api/v1/courier/orders/${orderId}/complete`)
      .set('Authorization', `Bearer ${courierB}`)
      .expect(404);
    expect(again.body.error.code).toBe('ORDER_NOT_FOUND');
    geocoding.clear();
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
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'OwnerPassword1' })
      .expect(200);
    return {
      token: loginResponse.body.accessToken as string,
      tenantSlug,
      tenantId: tenant.body.id as string,
    };
  }

  function postOrder(tenantSlug: string, productId: string, address: AddressBody) {
    return request(app.getHttpServer())
      .post('/api/v1/public/orders')
      .set('X-Tenant-Host', `${tenantSlug}.localhost`)
      .set('Idempotency-Key', randomUUID())
      .send({
        customer: { name: 'Ana', phone: '11988887777' },
        fulfillment: 'DELIVERY',
        address,
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

  async function createCourier(token: string, name: string, password: string) {
    const email = `${name.toLowerCase()}-${randomBytes(3).toString('hex')}@example.com`;
    emails.push(email);
    return request(app.getHttpServer())
      .post('/api/v1/admin/couriers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, phone: '11977776666', email, password })
      .expect(201);
  }

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return response.body.accessToken as string;
  }
});

interface AddressBody {
  line: string;
  number: string;
  district: string;
  city: string;
  state: string;
  postalCode: string;
  complement: null;
}

function deliveryAddress(): AddressBody {
  return {
    line: 'Rua A',
    number: '10',
    district: 'Centro',
    city: 'Sao Paulo',
    state: 'SP',
    postalCode: '01001000',
    complement: null,
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

async function countOrders(dataSource: DataSource, tenantId: string): Promise<number> {
  const rows: Array<{ total: number | string }> = await dataSource.query(
    `SELECT COUNT(*) AS total FROM orders WHERE tenant_id = ?`,
    [tenantId],
  );
  return Number(rows[0]?.total ?? 0);
}

async function statuses(dataSource: DataSource, orderId: string): Promise<string[]> {
  const rows: Array<{ to_status: string }> = await dataSource.query(
    `SELECT to_status FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC, id ASC`,
    [orderId],
  );
  return rows.map((row) => row.to_status);
}

async function eventTypes(dataSource: DataSource, orderId: string): Promise<string[]> {
  const rows: Array<{ type: string }> = await dataSource.query(
    `SELECT type FROM outbox_events WHERE aggregate_id = ? ORDER BY created_at ASC, id ASC`,
    [orderId],
  );
  return rows.map((row) => row.type);
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
