import { randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { loadEnvFile } from '@ciadelivery/shared';
import Redis from 'ioredis';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createApiApplication } from './bootstrap';

const envSnapshot = { ...process.env };
const adminEmail = 'platform-admin@ciadelivery.test';
const adminPassword = 'PlatformAdmin1';

function slug(prefix: string): string {
  return `${prefix}-${randomBytes(4).toString('hex')}`;
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

describe('courier assignment', () => {
  jest.setTimeout(60_000);

  let app!: INestApplication;
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
    app = await createApiApplication();
    await app.init();
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
          `DELETE FROM delivery_assignments WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM couriers WHERE tenant_id IN (${marks})`,
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

  it('assigns a ready delivery and lets only that courier finish it', async () => {
    const owner = await createOwner('courier-a', 'Courier A');
    const otherOwner = await createOwner('courier-b', 'Courier B');
    const productId = await createProduct(owner.token);
    await openStore(owner.token);
    const dataSource = app.get(DataSource);
    const password = 'CourierPassword1';
    const first = await createCourier(owner.token, 'Lia', password);
    const second = await createCourier(owner.token, 'Caio', 'CourierPassword2');
    expect(first.body.initialPassword).toBe(password);
    expect(first.body.email).toContain('@example.com');
    const stored: Array<{ password_hash: string }> = await dataSource.query(
      `SELECT password_hash FROM users WHERE id = ?`,
      [first.body.userId],
    );
    expect(stored[0]?.password_hash).not.toBe(password);
    expect(stored[0]?.password_hash.startsWith('$argon2')).toBe(true);
    const listed = await request(app.getHttpServer())
      .get('/api/v1/admin/couriers')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(JSON.stringify(listed.body)).not.toContain(password);

    const foreign = await request(app.getHttpServer())
      .post('/api/v1/admin/couriers')
      .set('Authorization', `Bearer ${otherOwner.token}`)
      .send({
        name: 'Fora',
        phone: '11966665555',
        email: rememberEmail('fora'),
        password: 'CourierPassword3',
      })
      .expect(201);

    const tooEarly = await postOrder(owner.tenantSlug, productId);
    expect(tooEarly.status).toBe(201);
    const earlyId = tooEarly.body.orderId as string;
    const notReady = await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${earlyId}/assign-courier`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ courierId: first.body.id })
      .expect(409);
    expect(notReady.body.error.code).toBe('ORDER_NOT_READY');

    const pickup = await postOrder(owner.tenantSlug, productId, 'PICKUP');
    const pickupId = pickup.body.orderId as string;
    await advance(owner.token, pickupId, ['accept', 'start-preparation', 'ready']);
    const pickupAssign = await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${pickupId}/assign-courier`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ courierId: first.body.id })
      .expect(409);
    expect(pickupAssign.body.error.code).toBe('PICKUP_NOT_ASSIGNABLE');

    const missingCourier = await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${earlyId}/dispatch`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(409);
    expect(missingCourier.body.error.code).toBe('ORDER_INVALID_TRANSITION');

    await advance(owner.token, earlyId, ['accept', 'start-preparation', 'ready']);
    const historyBefore = await countHistory(dataSource, earlyId);
    const withoutAssignment = await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${earlyId}/dispatch`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(409);
    expect(withoutAssignment.body.error.code).toBe('COURIER_REQUIRED');

    const wrongTenant = await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${earlyId}/assign-courier`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ courierId: foreign.body.id })
      .expect(404);
    expect(wrongTenant.body.error.code).toBe('COURIER_NOT_FOUND');

    const assigned = await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${earlyId}/assign-courier`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ courierId: first.body.id })
      .expect(200);
    expect(assigned.body.status).toBe('READY');
    expect(await countHistory(dataSource, earlyId)).toBe(historyBefore);
    const events: Array<{ type: string }> = await dataSource.query(
      `SELECT type FROM outbox_events WHERE aggregate_id = ? ORDER BY created_at ASC`,
      [earlyId],
    );
    expect(events.map((row) => row.type)).toContain('order.courier_assigned');

    const courierA = await login(first.body.email as string, password);
    const courierB = await login(second.body.email as string, 'CourierPassword2');
    const hidden = await request(app.getHttpServer())
      .get(`/api/v1/courier/orders/${earlyId}`)
      .set('Authorization', `Bearer ${courierB}`)
      .expect(404);
    expect(hidden.body.error.code).toBe('ORDER_NOT_FOUND');
    const ownerDenied = await request(app.getHttpServer())
      .get('/api/v1/courier/orders')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(403);
    expect(ownerDenied.body.error.code).toBe('FORBIDDEN');

    const mine = await request(app.getHttpServer())
      .get('/api/v1/courier/orders')
      .set('Authorization', `Bearer ${courierA}`)
      .expect(200);
    expect(mine.body.data).toEqual([
      expect.objectContaining({ id: earlyId, status: 'READY' }),
    ]);
    expect(JSON.stringify(mine.body)).not.toContain('Ana');
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/courier/orders/${earlyId}`)
      .set('Authorization', `Bearer ${courierA}`)
      .expect(200);
    expect(detail.body.customerPhone).toBe('5511988887777');
    expect(detail.body.address.line).toBe('Rua A');
    expect(detail.body.orderNumber).toBe(assigned.body.orderNumber);

    const started = await request(app.getHttpServer())
      .post(`/api/v1/courier/orders/${earlyId}/start`)
      .set('Authorization', `Bearer ${courierA}`)
      .expect(200);
    expect(started.body.status).toBe('OUT_FOR_DELIVERY');
    const stolen = await request(app.getHttpServer())
      .post(`/api/v1/courier/orders/${earlyId}/complete`)
      .set('Authorization', `Bearer ${courierB}`)
      .expect(404);
    expect(stolen.body.error.code).toBe('ORDER_NOT_FOUND');
    const completed = await request(app.getHttpServer())
      .post(`/api/v1/courier/orders/${earlyId}/complete`)
      .set('Authorization', `Bearer ${courierA}`)
      .expect(200);
    expect(completed.body.status).toBe('DELIVERED');
    const history = await request(app.getHttpServer())
      .get('/api/v1/courier/deliveries')
      .set('Authorization', `Bearer ${courierA}`)
      .expect(200);
    expect(history.body.data).toEqual([
      expect.objectContaining({ id: earlyId }),
    ]);
    const gone = await request(app.getHttpServer())
      .get('/api/v1/courier/orders')
      .set('Authorization', `Bearer ${courierA}`)
      .expect(200);
    expect(gone.body.data).toEqual([]);
  });

  async function createCourier(token: string, name: string, password: string) {
    const email = rememberEmail(name);
    return request(app.getHttpServer())
      .post('/api/v1/admin/couriers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, phone: '11977776666', email, password })
      .expect(201);
  }

  function rememberEmail(name: string): string {
    const email = `${name.toLowerCase()}-${randomBytes(3).toString('hex')}@example.com`;
    emails.push(email);
    return email;
  }

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return response.body.accessToken as string;
  }

  async function advance(
    token: string,
    orderId: string,
    steps: string[],
  ): Promise<void> {
    for (const step of steps) {
      await request(app.getHttpServer())
        .post(`/api/v1/admin/orders/${orderId}/${step}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    }
  }

  async function countHistory(
    dataSource: DataSource,
    orderId: string,
  ): Promise<number> {
    const rows: Array<{ total: number | string }> = await dataSource.query(
      `SELECT COUNT(*) AS total FROM order_status_history WHERE order_id = ?`,
      [orderId],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async function postOrder(
    tenantSlug: string,
    productId: string,
    fulfillment: 'DELIVERY' | 'PICKUP' = 'DELIVERY',
  ) {
    return request(app.getHttpServer())
      .post('/api/v1/public/orders')
      .set('X-Tenant-Host', `${tenantSlug}.localhost`)
      .set('Idempotency-Key', randomUUID())
      .send({
        customer: { name: 'Ana', phone: '11988887777' },
        fulfillment,
        ...(fulfillment === 'DELIVERY'
          ? {
              address: {
                line: 'Rua A',
                number: '10',
                district: 'Centro',
                city: 'São Paulo',
                state: 'SP',
                postalCode: '01001000',
                complement: null,
              },
            }
          : {}),
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
        priceCents: 1500,
        active: true,
        available: true,
      })
      .expect(201);
    return product.body.id as string;
  }

  async function createOwner(
    prefix: string,
    name: string,
  ): Promise<{ token: string; tenantSlug: string; tenantId: string }> {
    const admin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(200);
    const tenantSlug = slug(prefix);
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
    const email = rememberEmail(prefix);
    await request(app.getHttpServer())
      .post(`/api/v1/platform/tenants/${tenant.body.id as string}/owner`)
      .set('Authorization', `Bearer ${admin.body.accessToken as string}`)
      .send({ name, email, password: 'OwnerPassword1' })
      .expect(201);
    const token = await login(email, 'OwnerPassword1');
    return { token, tenantSlug, tenantId: tenant.body.id as string };
  }
});
