import { randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { loadEnvFile } from '@ciadelivery/shared';
import Redis from 'ioredis';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createApiApplication } from './bootstrap';

const adminEmail = 'platform-admin@ciadelivery.test';
const adminPassword = 'PlatformAdmin1';

function slug(prefix: string): string {
  return `${prefix}-${randomBytes(4).toString('hex')}`;
}

function storeToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
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

describe('basic reports', () => {
  jest.setTimeout(90_000);

  let app!: INestApplication;
  const createdTenantIds: string[] = [];

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
          `DELETE FROM audit_logs WHERE tenant_id IN (${marks})`,
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
      await app.close();
    }
  });

  it('sums only the store orders that were not cancelled', async () => {
    const owner = await createOwner('reports', 'Loja Relatorio');
    const other = await createOwner('reports-b', 'Outra Loja');
    await openStore(owner.token);
    await openStore(other.token);
    const productId = await createProduct(owner.token, 1500);
    const otherProductId = await createProduct(other.token, 9900);

    const pickup = await place(owner.tenantSlug, productId, 'PICKUP');
    const delivery = await place(owner.tenantSlug, productId, 'DELIVERY');
    const cancelled = await place(owner.tenantSlug, productId, 'PICKUP');
    const foreign = await place(other.tenantSlug, otherProductId, 'PICKUP');
    await app
      .get(DataSource)
      .query(`UPDATE orders SET source = 'WHATSAPP' WHERE id = ?`, [
        delivery.orderId,
      ]);

    await advance(owner.token, pickup.orderId, [
      'accept',
      'start-preparation',
      'ready',
      'complete-pickup',
    ]);
    await advance(owner.token, delivery.orderId, [
      'accept',
      'start-preparation',
      'ready',
    ]);
    const courier = await createCourier(owner.token);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${delivery.orderId}/assign-courier`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ courierId: courier.id })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${delivery.orderId}/dispatch`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${delivery.orderId}/deliver`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${cancelled.orderId}/cancel`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ note: 'Cliente desistiu' })
      .expect(200);
    await advance(other.token, foreign.orderId, [
      'accept',
      'start-preparation',
      'ready',
      'complete-pickup',
    ]);

    const today = storeToday();
    const overview = await request(app.getHttpServer())
      .get('/api/v1/admin/reports/overview')
      .query({ from: today, to: today })
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    const revenue = pickup.totalCents + delivery.totalCents;
    expect(overview.body.orderCount).toBe(3);
    expect(overview.body.revenueCents).toBe(revenue);
    expect(overview.body.averageTicketCents).toBe(Math.trunc(revenue / 2));
    expect(overview.body.cancelledCount).toBe(1);
    expect(overview.body.byStatus).toEqual(
      expect.arrayContaining([
        { status: 'DELIVERED', count: 2 },
        { status: 'CANCELLED', count: 1 },
      ]),
    );
    expect(overview.body.bySource).toEqual(
      expect.arrayContaining([
        { source: 'STOREFRONT', count: 2 },
        { source: 'WHATSAPP', count: 1 },
      ]),
    );
    expect(overview.body.revenueCents).not.toBe(revenue + foreign.totalCents);

    const otherOverview = await request(app.getHttpServer())
      .get('/api/v1/admin/reports/overview')
      .query({ from: today, to: today })
      .set('Authorization', `Bearer ${other.token}`)
      .expect(200);
    expect(otherOverview.body.orderCount).toBe(1);
    expect(otherOverview.body.revenueCents).toBe(foreign.totalCents);

    const products = await request(app.getHttpServer())
      .get('/api/v1/admin/reports/products')
      .query({ from: today, to: today })
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(products.body).toEqual([
      expect.objectContaining({
        productName: 'Margherita',
        quantity: 2,
        subtotalCents: 3000,
      }),
    ]);

    const customers = await request(app.getHttpServer())
      .get('/api/v1/admin/reports/customers')
      .query({ from: today, to: today })
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(customers.body).toEqual([
      expect.objectContaining({ name: 'Ana', orderCount: 3 }),
    ]);
    const customerPayload = JSON.stringify(customers.body);
    expect(customerPayload).not.toContain('11988887777');
    expect(customerPayload).not.toContain('5511988887777');
    expect(customers.body[0].maskedPhone.endsWith('7777')).toBe(true);

    const couriers = await request(app.getHttpServer())
      .get('/api/v1/admin/reports/couriers')
      .query({ from: today, to: today })
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(couriers.body).toEqual([
      expect.objectContaining({ name: 'Lia', deliveredCount: 1 }),
    ]);

    const csv = await request(app.getHttpServer())
      .get('/api/v1/admin/reports/orders.csv')
      .query({ from: today, to: today })
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(csv.headers['content-disposition']).toContain('attachment');
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('número;data;status;total;origem;tipo');
    expect(csv.text).toContain(String(pickup.orderNumber));
    expect(csv.text).not.toContain(pickup.trackingToken);
    expect(csv.text).not.toContain(delivery.trackingToken);
    expect(csv.text).not.toContain('11988887777');
    expect(csv.text).not.toContain('5511988887777');
    expect(csv.text.toLowerCase()).not.toContain('telefone');

    const tooLong = await request(app.getHttpServer())
      .get('/api/v1/admin/reports/overview')
      .query({ from: '2024-01-01', to: '2025-01-01' })
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(400);
    expect(tooLong.body.error.code).toBe('REPORT_PERIOD_INVALID');
  });

  it('keeps another tenant out of the daily dashboard', async () => {
    const owner = await createOwner('dash', 'Loja Painel');
    const other = await createOwner('dash-b', 'Outra Painel');
    await openStore(owner.token);
    await openStore(other.token);
    const productId = await createProduct(owner.token, 1500);
    const otherProductId = await createProduct(other.token, 9900);
    const fresh = await place(owner.tenantSlug, productId, 'PICKUP');
    const cancelled = await place(owner.tenantSlug, productId, 'PICKUP');
    const foreign = await place(other.tenantSlug, otherProductId, 'PICKUP');
    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${cancelled.orderId}/cancel`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ note: 'Cliente desistiu' })
      .expect(200);
    await advance(other.token, foreign.orderId, [
      'accept',
      'start-preparation',
      'ready',
      'complete-pickup',
    ]);

    const dashboard = await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(dashboard.body.newCount).toBe(1);
    expect(dashboard.body.revenueCents).toBe(fresh.totalCents);
    expect(dashboard.body.deliveredTodayCount).toBe(0);
    expect(dashboard.body.revenueCents).not.toBe(
      fresh.totalCents + cancelled.totalCents + foreign.totalCents,
    );

    const otherDashboard = await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${other.token}`)
      .expect(200);
    expect(otherDashboard.body.revenueCents).toBe(foreign.totalCents);
    expect(otherDashboard.body.deliveredTodayCount).toBe(1);
    expect(otherDashboard.body.newCount).toBe(0);

    const attendantEmail = rememberEmail('caixa');
    await request(app.getHttpServer())
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Caixa',
        email: attendantEmail,
        password: 'Attendant123',
        role: 'ATTENDANT',
        permissionOverrides: [{ permission: 'orders.read', granted: false }],
      })
      .expect(201);
    const attendantToken = await login(attendantEmail, 'Attendant123');
    const denied = await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${attendantToken}`)
      .expect(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
  });

  async function place(
    tenantSlug: string,
    productId: string,
    fulfillment: 'DELIVERY' | 'PICKUP',
  ): Promise<{
    orderId: string;
    orderNumber: number;
    totalCents: number;
    trackingToken: string;
  }> {
    const response = await request(app.getHttpServer())
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
      })
      .expect(201);
    return {
      orderId: response.body.orderId as string,
      orderNumber: response.body.orderNumber as number,
      totalCents: response.body.totalCents as number,
      trackingToken: response.body.trackingToken as string,
    };
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

  async function createCourier(
    token: string,
  ): Promise<{ id: string }> {
    const email = rememberEmail('lia');
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/couriers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Lia',
        phone: '11977776666',
        email,
        password: 'CourierPassword1',
      })
      .expect(201);
    return { id: response.body.id as string };
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

  async function createProduct(token: string, priceCents: number): Promise<string> {
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
        priceCents,
        active: true,
        available: true,
      })
      .expect(201);
    return product.body.id as string;
  }

  async function createOwner(
    prefix: string,
    name: string,
  ): Promise<{ token: string; tenantSlug: string }> {
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
    return { token, tenantSlug };
  }

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return response.body.accessToken as string;
  }

  function rememberEmail(name: string): string {
    return `${name}-${randomBytes(3).toString('hex')}@example.com`;
  }
});
