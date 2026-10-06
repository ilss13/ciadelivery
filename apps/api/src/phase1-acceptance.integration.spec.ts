import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { loadEnvFile } from '@ciadelivery/shared';
import Redis from 'ioredis';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createApiApplication } from './bootstrap';
import { publishStoreForTests } from './publish-store-for-tests';

const envSnapshot = { ...process.env };
const adminEmail = 'platform-admin@ciadelivery.test';
const adminPassword = 'PlatformAdmin1';
const ownerPassword = 'OwnerPassword1';

interface OwnerSession {
  token: string;
  email: string;
  tenantId: string;
  tenantSlug: string;
  userId: string;
  storeName: string;
}

function slug(prefix: string): string {
  return `${prefix}-${randomBytes(4).toString('hex')}`;
}

function address(city = 'Sao Paulo') {
  return {
    line: 'Rua das Flores',
    number: '100',
    district: 'Centro',
    city,
    state: 'SP',
    postalCode: '01000-000',
  };
}

function branding(primaryColor: string, displayName: string) {
  return {
    displayName,
    logoUrl: null,
    faviconUrl: null,
    bannerUrl: null,
    primaryColor,
    secondaryColor: '#FFFFFF',
    accentColor: '#111111',
    fontFamily: null,
    seoTitle: displayName,
    seoDescription: '',
    instagramUrl: null,
    facebookUrl: null,
    websiteUrl: null,
    contactEmail: null,
    whatsappPhone: null,
  };
}

function hours(opensAt: string, closesAt: string) {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    opensAt,
    closesAt,
    closed: false,
  }));
}

async function clearLoginRateLimits(): Promise<void> {
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

describe('phase 1 acceptance', () => {
  let app!: INestApplication;
  const createdTenantIds: string[] = [];
  const emails: string[] = [];

  beforeAll(async () => {
    loadEnvFile();
    process.env['NODE_ENV'] = 'local';
    process.env['JWT_ACCESS_SECRET'] =
      process.env['JWT_ACCESS_SECRET'] ?? 'local-development-jwt-access-secret';
    process.env['SEED_PLATFORM_ADMIN'] = 'true';
    process.env['PLATFORM_ADMIN_EMAIL'] = adminEmail;
    process.env['PLATFORM_ADMIN_PASSWORD'] = adminPassword;
    process.env['LOG_PASSWORD_RESET'] = 'false';
    app = await createApiApplication();
    await app.init();
  });

  beforeEach(async () => {
    await clearLoginRateLimits();
  });

  afterAll(async () => {
    if (app !== undefined) {
      const dataSource = app.get(DataSource);
      if (dataSource.isInitialized && createdTenantIds.length > 0) {
        const marks = createdTenantIds.map(() => '?').join(', ');
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
      await clearLoginRateLimits();
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

  it('keeps two companies isolated, including host and body tenant ids', async () => {
    const ownerA = await createOwner('fase1-a', 'Loja Alfa', 'Sao Paulo');
    const ownerB = await createOwner('fase1-b', 'Loja Beta', 'Campinas');
    await request(app.getHttpServer())
      .put('/api/v1/admin/branding')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send(branding('#112233', 'Marca Alfa'))
      .expect(200);
    await request(app.getHttpServer())
      .put('/api/v1/admin/branding')
      .set('Authorization', `Bearer ${ownerB.token}`)
      .send(branding('#ABCDEF', 'Marca Beta'))
      .expect(200);
    await request(app.getHttpServer())
      .put('/api/v1/admin/store/hours')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ hours: hours('09:00:00', '17:00:00') })
      .expect(200);
    await request(app.getHttpServer())
      .put('/api/v1/admin/store/hours')
      .set('Authorization', `Bearer ${ownerB.token}`)
      .send({ hours: hours('18:00:00', '23:30:00') })
      .expect(200);

    const publicA = await request(app.getHttpServer())
      .get('/api/v1/public/store')
      .set('X-Tenant-Host', `${ownerA.tenantSlug}.localhost`)
      .expect(200);
    const publicB = await request(app.getHttpServer())
      .get('/api/v1/public/store')
      .set('X-Tenant-Host', `${ownerB.tenantSlug}.localhost`)
      .expect(200);
    expect(publicA.body.slug).toBe(ownerA.tenantSlug);
    expect(publicA.body.branding.displayName).toBe('Marca Alfa');
    expect(publicA.body.branding.primaryColor).toBe('#112233');
    expect(publicA.body.hours[0]).toMatchObject({
      opensAt: '09:00:00',
      closesAt: '17:00:00',
    });
    expect(publicB.body.slug).toBe(ownerB.tenantSlug);
    expect(publicB.body.branding.displayName).toBe('Marca Beta');
    expect(publicB.body.branding.primaryColor).toBe('#ABCDEF');
    expect(publicB.body.hours[0]).toMatchObject({
      opensAt: '18:00:00',
      closesAt: '23:30:00',
    });
    expect(JSON.stringify(publicA.body)).not.toContain('Marca Beta');
    expect(JSON.stringify(publicA.body)).not.toContain('Loja Beta');
    expect(JSON.stringify(publicA.body)).not.toContain('#ABCDEF');
    expect(JSON.stringify(publicA.body)).not.toContain(ownerB.tenantId);
    expect(JSON.stringify(publicB.body)).not.toContain('Marca Alfa');
    expect(JSON.stringify(publicB.body)).not.toContain('Loja Alfa');
    expect(JSON.stringify(publicB.body)).not.toContain('#112233');

    const logs: string[] = [];
    const stdout = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk) => {
        logs.push(String(chunk));
        return true;
      });
    let storeA: request.Response;
    let brandingA: request.Response;
    let usersA: request.Response;
    try {
      storeA = await request(app.getHttpServer())
        .get('/api/v1/admin/store')
        .set('Authorization', `Bearer ${ownerA.token}`)
        .set('X-Tenant-Host', `${ownerB.tenantSlug}.localhost`)
        .expect(200);
      brandingA = await request(app.getHttpServer())
        .get('/api/v1/admin/branding')
        .set('Authorization', `Bearer ${ownerA.token}`)
        .set('X-Tenant-Host', `${ownerB.tenantSlug}.localhost`)
        .expect(200);
      usersA = await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${ownerA.token}`)
        .set('X-Tenant-Host', `${ownerB.tenantSlug}.localhost`)
        .expect(200);
    } finally {
      stdout.mockRestore();
    }

    expect(storeA.body.name).toBe('Loja Alfa');
    expect(JSON.stringify(storeA.body)).not.toContain('Loja Beta');
    expect(JSON.stringify(storeA.body)).not.toContain(ownerB.tenantId);
    expect(brandingA.body.displayName).toBe('Marca Alfa');
    expect(brandingA.body.primaryColor).toBe('#112233');
    expect(JSON.stringify(brandingA.body)).not.toContain('Marca Beta');
    expect(JSON.stringify(brandingA.body)).not.toContain('#ABCDEF');
    const userIds = (
      usersA.body.data as Array<{ id: string; email: string }>
    ).map((user) => user.id);
    expect(userIds).toContain(ownerA.userId);
    expect(userIds).not.toContain(ownerB.userId);
    expect(JSON.stringify(usersA.body)).not.toContain(ownerB.email);
    expect(JSON.stringify(usersA.body)).not.toContain(ownerB.tenantId);

    const accessLogs = logs.filter((line) => line.includes('admin access'));
    expect(accessLogs.length).toBeGreaterThanOrEqual(3);
    for (const line of accessLogs) {
      const parsed = JSON.parse(line) as { level: string; message: string };
      expect(parsed.level).toBe('info');
      const payload = JSON.parse(parsed.message) as {
        userId: string;
        tenantId: string;
        action: string;
      };
      expect(payload.userId).toBe(ownerA.userId);
      expect(payload.tenantId).toBe(ownerA.tenantId);
      expect(payload.action).toMatch(/^GET \/api\/v1\/admin\//);
      expect(line).not.toContain(ownerPassword);
      expect(line).not.toContain(ownerA.email);
      expect(line).not.toContain(ownerB.email);
    }

    const missingUser = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${ownerB.userId}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(404);
    expect(missingUser.body.error.code).toBe('USER_NOT_FOUND');
    expect(missingUser.status).not.toBe(403);
    const missingPatch = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${ownerB.userId}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ name: 'Invasao' })
      .expect(404);
    expect(missingPatch.body.error.code).toBe('USER_NOT_FOUND');

    const injectedBranding = await request(app.getHttpServer())
      .put('/api/v1/admin/branding')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ ...branding('#112233', 'Marca Alfa'), tenantId: ownerB.tenantId })
      .expect(400);
    expect(injectedBranding.body.error.code).toBe('VALIDATION_ERROR');
    const injectedStore = await request(app.getHttpServer())
      .put('/api/v1/admin/store')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({
        name: 'Loja Alfa',
        phone: '11999999999',
        address: address(),
        minimumOrderCents: 0,
        isManuallyClosed: false,
        tenantId: ownerB.tenantId,
      })
      .expect(400);
    expect(injectedStore.body.error.code).toBe('VALIDATION_ERROR');
    const injectedUser = await request(app.getHttpServer())
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({
        name: 'Invasao',
        email: `invasao-${randomBytes(3).toString('hex')}@example.com`,
        password: ownerPassword,
        role: 'ATTENDANT',
        tenantId: ownerB.tenantId,
      })
      .expect(400);
    expect(injectedUser.body.error.code).toBe('VALIDATION_ERROR');

    const stillA = await request(app.getHttpServer())
      .get('/api/v1/public/store')
      .set('X-Tenant-Host', `${ownerA.tenantSlug}.localhost`)
      .expect(200);
    const stillB = await request(app.getHttpServer())
      .get('/api/v1/public/store')
      .set('X-Tenant-Host', `${ownerB.tenantSlug}.localhost`)
      .expect(200);
    expect(stillA.body.branding.primaryColor).toBe('#112233');
    expect(stillA.body.name).toBe('Loja Alfa');
    expect(stillB.body.branding.primaryColor).toBe('#ABCDEF');
    expect(stillB.body.name).toBe('Loja Beta');
    const usersB = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${ownerB.token}`)
      .expect(200);
    expect(usersB.body.data).toHaveLength(1);
    expect(usersB.body.data[0].id).toBe(ownerB.userId);
  });

  it('refuses login when the tenant is suspended', async () => {
    const owner = await createOwner(
      'fase1-suspenso',
      'Loja Suspensa',
      'Santos',
    );
    const admin = await platformToken();
    await request(app.getHttpServer())
      .patch(`/api/v1/platform/tenants/${owner.tenantId}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ status: 'SUSPENDED' })
      .expect(200);
    const denied = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: owner.email, password: ownerPassword })
      .expect(403);
    expect(denied.body.error.code).toBe('TENANT_SUSPENDED');
    expect(denied.body.accessToken).toBeUndefined();
  });

  it('lets the platform admin list both tenants and blocks store admin routes', async () => {
    const ownerA = await createOwner(
      'fase1-plat-a',
      'Plataforma Alfa',
      'Sao Paulo',
    );
    const ownerB = await createOwner(
      'fase1-plat-b',
      'Plataforma Beta',
      'Campinas',
    );
    const admin = await platformToken();
    const listed = await request(app.getHttpServer())
      .get('/api/v1/platform/tenants')
      .query({ page: 1, pageSize: 100 })
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    const ids = (listed.body.data as Array<{ id: string }>).map(
      (tenant) => tenant.id,
    );
    expect(ids).toContain(ownerA.tenantId);
    expect(ids).toContain(ownerB.tenantId);

    const store = await request(app.getHttpServer())
      .get('/api/v1/admin/store')
      .set('Authorization', `Bearer ${admin}`)
      .expect(403);
    expect(store.body.error.code).toBe('FORBIDDEN');
    expect(JSON.stringify(store.body)).not.toContain('Plataforma Alfa');
    expect(JSON.stringify(store.body)).not.toContain('Plataforma Beta');
    const brandingDenied = await request(app.getHttpServer())
      .get('/api/v1/admin/branding')
      .set('Authorization', `Bearer ${admin}`)
      .expect(403);
    expect(brandingDenied.body.error.code).toBe('FORBIDDEN');
    const usersDenied = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${admin}`)
      .expect(403);
    expect(usersDenied.body.error.code).toBe('FORBIDDEN');
  });

  async function platformToken(): Promise<string> {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(200);
    return login.body.accessToken as string;
  }

  async function createOwner(
    prefix: string,
    name: string,
    city: string,
  ): Promise<OwnerSession> {
    const admin = await platformToken();
    const tenantSlug = slug(prefix);
    const tenant = await request(app.getHttpServer())
      .post('/api/v1/platform/tenants')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        name,
        slug: tenantSlug,
        phone: '11999999999',
        address: address(city),
      })
      .expect(201);
    createdTenantIds.push(tenant.body.id as string);
    await publishStoreForTests(app, tenant.body.id as string);
    const email = `${prefix}-${randomBytes(3).toString('hex')}@example.com`;
    emails.push(email);
    await request(app.getHttpServer())
      .post(`/api/v1/platform/tenants/${tenant.body.id as string}/owner`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ name, email, password: ownerPassword })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: ownerPassword })
      .expect(200);
    const token = login.body.accessToken as string;
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return {
      token,
      email,
      tenantId: tenant.body.id as string,
      tenantSlug,
      userId: me.body.id as string,
      storeName: name,
    };
  }
});
