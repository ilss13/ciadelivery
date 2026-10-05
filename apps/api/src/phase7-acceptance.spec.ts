import { randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { APP_CONFIG, AppConfig, loadEnvFile } from '@ciadelivery/shared';
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

describe('phase 7 acceptance', () => {
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
    if (app === undefined) {
      return;
    }
    const dataSource = app.get(DataSource);
    if (dataSource.isInitialized && createdTenantIds.length > 0) {
      const marks = createdTenantIds.map(() => '?').join(', ');
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
  });

  it('runs the store day through the establishment API', async () => {
    const owner = await createOwner('fase7', 'Loja do Dia');
    const beforeOrders = counter(await scrape(), 'orders_created_total');

    const dashboard = await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(dashboard.body).toEqual(
      expect.objectContaining({
        newCount: expect.any(Number),
        storeOpen: expect.any(Boolean),
      }),
    );

    await openStore(owner.token);
    const productId = await createProduct(owner.token);
    const catalog = await request(app.getHttpServer())
      .get('/api/v1/public/products')
      .set('X-Tenant-Host', `${owner.tenantSlug}.localhost`)
      .expect(200);
    expect(catalog.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: productId, name: 'Margherita' }),
      ]),
    );

    const order = await place(owner.tenantSlug, productId);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${order.orderId}/accept`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    const preparing = await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${order.orderId}/start-preparation`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(preparing.body.status).toBe('IN_PREPARATION');

    const customers = await request(app.getHttpServer())
      .get('/api/v1/admin/customers')
      .query({ phone: '11988887777' })
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(customers.body.data).toEqual([
      expect.objectContaining({ name: 'Ana', phone: '5511988887777' }),
    ]);
    const today = storeToday();
    const report = await request(app.getHttpServer())
      .get('/api/v1/admin/reports/overview')
      .query({ from: today, to: today })
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(report.body.orderCount).toBeGreaterThanOrEqual(1);

    const audit = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs')
      .query({ entityType: 'order', page: 1, pageSize: 100 })
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    const actions = (audit.body.data as Array<{ action: string }>).map(
      (entry) => entry.action,
    );
    expect(actions).toEqual(
      expect.arrayContaining(['order.accepted', 'order.in_preparation']),
    );

    const attendantEmail = rememberEmail('caixa');
    await request(app.getHttpServer())
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Caixa',
        email: attendantEmail,
        password: 'Attendant123',
        role: 'ATTENDANT',
      })
      .expect(201);
    const attendant = await login(attendantEmail, 'Attendant123');
    const deniedAudit = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${attendant}`)
      .expect(403);
    expect(deniedAudit.body.error.code).toBe('FORBIDDEN');
    const deniedStore = await request(app.getHttpServer())
      .put('/api/v1/admin/store')
      .set('Authorization', `Bearer ${attendant}`)
      .send({ isManuallyClosed: true })
      .expect(403);
    expect(deniedStore.body.error.code).toBe('FORBIDDEN');

    const metrics = await scrape();
    expect(counter(metrics, 'orders_created_total')).toBeGreaterThanOrEqual(
      beforeOrders + 1,
    );
    expect(metrics).not.toContain(order.orderId);
    expect(metrics).toContain('mysql_up 1');
    expect(metrics).toContain('redis_up 1');
  });

  it('exports and anonymizes a customer without deleting the order', async () => {
    const owner = await createOwner('lgpd', 'Loja Privacidade');
    const other = await createOwner('lgpd-b', 'Outra Loja');
    await openStore(owner.token);
    const productId = await createProduct(owner.token);
    const order = await place(owner.tenantSlug, productId, 'DELIVERY');
    const listed = await request(app.getHttpServer())
      .get('/api/v1/admin/customers')
      .query({ phone: '11988887777' })
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    const customerId = listed.body.data[0].id as string;

    const exported = await request(app.getHttpServer())
      .get(`/api/v1/admin/customers/${customerId}/export`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(exported.body.customer.name).toBe('Ana');
    expect(exported.body.customer.addresses[0].line).toBe('Rua A');
    expect(exported.body.consents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ purpose: 'OPERATIONAL', granted: true }),
      ]),
    );
    expect(exported.body.orders).toEqual([
      expect.objectContaining({
        id: order.orderId,
        customerName: 'Ana',
        customerPhone: '5511988887777',
      }),
    ]);
    expect(JSON.stringify(exported.body)).not.toContain(other.tenantSlug);

    await request(app.getHttpServer())
      .get(`/api/v1/admin/customers/${customerId}/export`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(404);

    const attendantEmail = rememberEmail('caixa');
    await request(app.getHttpServer())
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Caixa',
        email: attendantEmail,
        password: 'Attendant123',
        role: 'ATTENDANT',
      })
      .expect(201);
    const attendant = await login(attendantEmail, 'Attendant123');
    await request(app.getHttpServer())
      .post(`/api/v1/admin/customers/${customerId}/anonymize`)
      .set('Authorization', `Bearer ${attendant}`)
      .send({ phone: '11988887777' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/customers/${customerId}/anonymize`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ phone: '11977776666' })
      .expect(409);

    const anonymized = await request(app.getHttpServer())
      .post(`/api/v1/admin/customers/${customerId}/anonymize`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ phone: '11988887777' })
      .expect(200);
    expect(anonymized.body.name).toBe('Cliente anonimizado');
    expect(anonymized.body.phone).toMatch(/^[0-9a-f]{64}$/);
    expect(anonymized.body.phone).not.toContain('88887777');
    expect(anonymized.body.addresses[0]).toEqual(
      expect.objectContaining({
        line: '',
        number: '',
        district: '',
        city: 'São Paulo',
        state: 'SP',
      }),
    );

    const kept = await request(app.getHttpServer())
      .get(`/api/v1/admin/orders/${order.orderId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(kept.body.customerName).toBe('Cliente anonimizado');
    expect(kept.body.customerPhone).toBe(anonymized.body.phone);
    expect(kept.body.address.city).toBe('São Paulo');
    expect(kept.body.address.line).toBe('');

    const audit = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs')
      .query({ action: 'customer.anonymized', pageSize: 20 })
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    const entry = (audit.body.data as Array<{ action: string }>).find(
      (row) => row.action === 'customer.anonymized',
    );
    expect(entry).toBeDefined();
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain('11988887777');
    expect(serialized).not.toContain('5511988887777');
  });

  async function scrape(): Promise<string> {
    const token = app.get<AppConfig>(APP_CONFIG).metricsToken;
    const call = request(app.getHttpServer()).get('/metrics');
    if (token !== null) {
      call.set('Authorization', `Bearer ${token}`);
    }
    const response = await call.expect(200);
    expect(response.headers['content-type']).toContain('text/plain');
    return response.text;
  }

  async function place(
    tenantSlug: string,
    productId: string,
    fulfillment: 'DELIVERY' | 'PICKUP' = 'PICKUP',
  ): Promise<{ orderId: string }> {
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
    return { orderId: response.body.orderId as string };
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

function counter(body: string, name: string): number {
  const match = new RegExp(`^${name} (\\d+)$`, 'm').exec(body);
  if (match?.[1] === undefined) {
    throw new Error(`Missing metric ${name}`);
  }
  return Number(match[1]);
}
