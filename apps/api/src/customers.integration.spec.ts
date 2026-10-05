import { randomBytes } from 'node:crypto';
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

function address() {
  return {
    line: 'Rua das Flores',
    number: '100',
    district: 'Centro',
    city: 'Sao Paulo',
    state: 'SP',
    postalCode: '01000-000',
  };
}

async function clearRateLimits(): Promise<void> {
  const redis = new Redis({
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: Number(process.env['REDIS_PORT'] ?? '6379'),
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  const keys = await redis.keys('auth:login:ip:*');
  const identify = await redis.keys('customers:identify:ip:*');
  const all = [...keys, ...identify];
  if (all.length > 0) {
    await redis.del(...all);
  }
  redis.disconnect();
}

describe('customers and offline payment methods', () => {
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

  it('keeps the same phone as two customers across tenants and refuses disabling every payment method', async () => {
    const ownerA = await createOwner('clientes-a', 'Clientes A');
    const ownerB = await createOwner('clientes-b', 'Clientes B');

    const identifiedA = await request(app.getHttpServer())
      .post('/api/v1/public/customers/identify')
      .set('X-Tenant-Host', `${ownerA.tenantSlug}.localhost`)
      .send({ name: 'Ana A', phone: '(11) 98888-7777' })
      .expect(200);
    const identifiedB = await request(app.getHttpServer())
      .post('/api/v1/public/customers/identify')
      .set('X-Tenant-Host', `${ownerB.tenantSlug}.localhost`)
      .send({ name: 'Ana B', phone: '11988887777' })
      .expect(200);

    expect(identifiedA.body).toEqual({
      customerId: identifiedA.body.customerId,
      name: 'Ana A',
      phone: '5511988887777',
    });
    expect(identifiedB.body.phone).toBe('5511988887777');
    expect(identifiedB.body.customerId).not.toBe(identifiedA.body.customerId);
    expect(identifiedA.body.addresses).toBeUndefined();

    const renamed = await request(app.getHttpServer())
      .post('/api/v1/public/customers/identify')
      .set('X-Tenant-Host', `${ownerA.tenantSlug}.localhost`)
      .send({ name: 'Ana Atualizada', phone: '5511988887777' })
      .expect(200);
    expect(renamed.body).toEqual({
      customerId: identifiedA.body.customerId,
      name: 'Ana Atualizada',
      phone: '5511988887777',
    });

    const invalid = await request(app.getHttpServer())
      .post('/api/v1/public/customers/identify')
      .set('X-Tenant-Host', `${ownerA.tenantSlug}.localhost`)
      .send({ name: 'Ana', phone: '123' })
      .expect(400);
    expect(invalid.body.error.code).toBe('INVALID_PHONE');

    const found = await request(app.getHttpServer())
      .get('/api/v1/admin/customers')
      .query({ phone: '(11) 98888-7777' })
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    expect(found.body.data).toEqual([
      expect.objectContaining({
        id: identifiedA.body.customerId,
        name: 'Ana Atualizada',
        phone: '5511988887777',
      }),
    ]);
    expect(JSON.stringify(found.body)).not.toContain('Ana B');
    expect(JSON.stringify(found.body)).not.toContain(identifiedB.body.customerId);

    const hidden = await request(app.getHttpServer())
      .get(`/api/v1/admin/customers/${identifiedB.body.customerId as string}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(404);
    expect(hidden.body.error.code).toBe('CUSTOMER_NOT_FOUND');

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/customers/${identifiedA.body.customerId as string}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    expect(detail.body.addresses).toEqual([]);
    expect(detail.body.phone).toBe('5511988887777');

    const methods = await request(app.getHttpServer())
      .get('/api/v1/admin/payment-methods')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    expect(methods.body.methods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CASH', enabled: true }),
        expect.objectContaining({ code: 'CARD_ON_DELIVERY', enabled: false }),
        expect.objectContaining({ code: 'PIX_MANUAL', enabled: false }),
        expect.objectContaining({ code: 'PAY_ON_PICKUP', enabled: true }),
      ]),
    );

    const disabled = await request(app.getHttpServer())
      .put('/api/v1/admin/payment-methods')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({
        methods: methods.body.methods.map(
          (method: { code: string; label: string; instructions: string | null }) => ({
            code: method.code,
            label: method.label,
            instructions: method.code === 'PIX_MANUAL' ? 'chave@pix' : method.instructions,
            enabled: false,
          }),
        ),
      })
      .expect(400);
    expect(disabled.body.error.code).toBe('PAYMENT_METHOD_REQUIRED');

    const kept = await request(app.getHttpServer())
      .get('/api/v1/admin/payment-methods')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    expect(kept.body.methods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CASH', enabled: true }),
        expect.objectContaining({ code: 'PAY_ON_PICKUP', enabled: true }),
      ]),
    );
  });

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
        address: address(),
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
});
