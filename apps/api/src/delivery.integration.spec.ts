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

const bands = [
  { fromKm: 0, toKm: 3, feeCents: 500 },
  { fromKm: 3, toKm: 5, feeCents: 700 },
  { fromKm: 5, toKm: 8, feeCents: 1000 },
];

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

describe('delivery configuration and zones', () => {
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

  it('saves radius and zones for the owner and keeps another tenant out', async () => {
    const ownerA = await createOwner('entrega-a', 'Entrega A');
    const ownerB = await createOwner('entrega-b', 'Entrega B');

    const initial = await request(app.getHttpServer())
      .get('/api/v1/admin/delivery/config')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    expect(initial.body).toEqual(
      expect.objectContaining({
        deliveryEnabled: true,
        pickupEnabled: true,
        feeMode: 'FLAT',
        flatFeeCents: 0,
        maxRadiusKm: 8,
      }),
    );

    const saved = await request(app.getHttpServer())
      .put('/api/v1/admin/delivery/config')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({
        deliveryEnabled: true,
        pickupEnabled: true,
        maxRadiusKm: 8,
        feeMode: 'ZONE',
        flatFeeCents: 0,
        estimatedMinutes: 35,
        zones: bands,
      })
      .expect(200);
    expect(saved.body.feeMode).toBe('ZONE');
    expect(saved.body.estimatedMinutes).toBe(35);

    const listed = await request(app.getHttpServer())
      .get('/api/v1/admin/delivery/zones')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    expect(listed.body.zones).toEqual([
      expect.objectContaining(bands[0]),
      expect.objectContaining(bands[1]),
      expect.objectContaining(bands[2]),
    ]);

    const overlap = await request(app.getHttpServer())
      .put('/api/v1/admin/delivery/zones')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({
        zones: [
          { fromKm: 0, toKm: 4, feeCents: 500 },
          { fromKm: 3, toKm: 8, feeCents: 700 },
        ],
      })
      .expect(422);
    expect(overlap.body.error.code).toBe('DELIVERY_ZONES_OVERLAP');

    const zoneId = listed.body.zones[0].id as string;
    const stolen = await request(app.getHttpServer())
      .patch(`/api/v1/admin/delivery/zones/${zoneId}`)
      .set('Authorization', `Bearer ${ownerB.token}`)
      .send({ feeCents: 1 })
      .expect(404);
    expect(stolen.body.error.code).toBe('DELIVERY_ZONE_NOT_FOUND');

    const unchanged = await request(app.getHttpServer())
      .get('/api/v1/admin/delivery/zones')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    expect(unchanged.body.zones[0].feeCents).toBe(500);

    const replaced = await request(app.getHttpServer())
      .put('/api/v1/admin/delivery/zones')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({
        zones: [{ fromKm: 0, toKm: 8, feeCents: 900 }],
      })
      .expect(200);
    expect(replaced.body.zones).toEqual([
      expect.objectContaining({ fromKm: 0, toKm: 8, feeCents: 900, sortOrder: 0 }),
    ]);
  });

  async function createOwner(
    prefix: string,
    name: string,
  ): Promise<{ token: string; tenantId: string }> {
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
});
