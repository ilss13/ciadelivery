import { randomBytes, randomUUID } from 'node:crypto';
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
const demoPassword = 'DemoOwner123';

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

function hours(
  opensAt: string,
  closesAt: string,
  closed = false,
): Array<{
  weekday: number;
  opensAt: string;
  closesAt: string;
  closed: boolean;
}> {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    opensAt,
    closesAt,
    closed,
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

describe('store branding, hours and settings', () => {
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
    process.env['SEED_DEMO'] = 'true';
    process.env['DEMO_OWNER_PASSWORD'] = demoPassword;
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

  it('returns each demo store from its own host', async () => {
    const pizza = await request(app.getHttpServer())
      .get('/api/v1/public/store')
      .set('X-Tenant-Host', 'pizzariadoze.localhost')
      .expect(200);
    const burger = await request(app.getHttpServer())
      .get('/api/v1/public/store')
      .set('X-Tenant-Host', 'burgercentral.localhost')
      .expect(200);

    expect(pizza.body.branding.primaryColor).toBe('#C0392B');
    expect(burger.body.branding.primaryColor).toBe('#E67E22');
    expect(pizza.body.slug).toBe('pizzariadoze');
    expect(burger.body.slug).toBe('burgercentral');
    expect(JSON.stringify(pizza.body)).not.toContain('Burger Central');
    expect(JSON.stringify(burger.body)).not.toContain('Pizzaria do Ze');
    expect(pizza.body.hours).toHaveLength(7);
    expect(pizza.body.hours.find((day: { weekday: number }) => day.weekday === 1)).toMatchObject({
      closed: true,
    });
    expect(pizza.body.hours.find((day: { weekday: number }) => day.weekday === 2)).toMatchObject({
      opensAt: '18:00:00',
      closesAt: '23:00:00',
      closed: false,
    });
    expect(typeof pizza.body.isOpen).toBe('boolean');
    expect(typeof burger.body.isOpen).toBe('boolean');

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'pizzariadoze-owner@example.com',
        password: demoPassword,
      })
      .expect(200);
    expect(JSON.stringify(login.body)).not.toContain(demoPassword);
  });

  it('publishes only the color saved by that tenant', async () => {
    const ownerA = await createOwner('loja-a', 'Loja A');
    const ownerB = await createOwner('loja-b', 'Loja B');
    await request(app.getHttpServer())
      .put('/api/v1/admin/branding')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send(branding('#C0392B', 'Loja A'))
      .expect(200);
    await request(app.getHttpServer())
      .put('/api/v1/admin/branding')
      .set('Authorization', `Bearer ${ownerB.token}`)
      .send(branding('#E67E22', 'Loja B'))
      .expect(200);

    const publicA = await request(app.getHttpServer())
      .get('/api/v1/public/store')
      .set('X-Tenant-Host', `${ownerA.tenantSlug}.localhost`)
      .expect(200);
    expect(publicA.body.branding.primaryColor).toBe('#C0392B');
    expect(JSON.stringify(publicA.body)).not.toContain('#E67E22');
    expect(JSON.stringify(publicA.body)).not.toContain('Loja B');

    const adminA = await request(app.getHttpServer())
      .get('/api/v1/admin/branding')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    expect(adminA.body.primaryColor).toBe('#C0392B');
    expect(JSON.stringify(adminA.body)).not.toContain('Loja B');
  });

  it('refuses a manager without store.configure and a branding id route', async () => {
    const owner = await createOwner('loja-manager', 'Loja Manager');
    const managerEmail = `manager-${randomBytes(3).toString('hex')}@example.com`;
    emails.push(managerEmail);
    await request(app.getHttpServer())
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Marina',
        email: managerEmail,
        password: 'ManagerPass1',
        role: 'MANAGER',
      })
      .expect(201);
    const manager = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: managerEmail, password: 'ManagerPass1' })
      .expect(200);
    const denied = await request(app.getHttpServer())
      .put('/api/v1/admin/branding')
      .set('Authorization', `Bearer ${manager.body.accessToken as string}`)
      .send(branding('#112233', 'Loja Manager'))
      .expect(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');

    const domainDenied = await request(app.getHttpServer())
      .put('/api/v1/admin/domain')
      .set('Authorization', `Bearer ${manager.body.accessToken as string}`)
      .send({ customDomain: 'pedidos.example.com' })
      .expect(403);
    expect(domainDenied.body.error.code).toBe('FORBIDDEN');

    const missing = await request(app.getHttpServer())
      .get(`/api/v1/admin/branding/${randomUUID()}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(404);
    expect(missing.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('rejects invalid colors, equal hours and a tenant id in the body', async () => {
    const owner = await createOwner('loja-invalid', 'Loja Invalid');
    const color = await request(app.getHttpServer())
      .put('/api/v1/admin/branding')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(branding('red', 'Loja Invalid'))
      .expect(400);
    expect(color.body.error.code).toBe('INVALID_COLOR');

    const foreign = await request(app.getHttpServer())
      .put('/api/v1/admin/branding')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ ...branding('#112233', 'Loja Invalid'), tenantId: randomUUID() })
      .expect(400);
    expect(foreign.body.error.code).toBe('VALIDATION_ERROR');

    const sameTime = await request(app.getHttpServer())
      .put('/api/v1/admin/store/hours')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ hours: hours('18:00:00', '18:00:00') })
      .expect(400);
    expect(sameTime.body.error.code).toBe('INVALID_BUSINESS_HOURS');

    await request(app.getHttpServer())
      .put('/api/v1/admin/store/hours')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ hours: hours('22:00', '02:00') })
      .expect(200);
  });

  it('updates store settings and closes the store inside opening hours', async () => {
    const owner = await createOwner('loja-settings', 'Loja Settings');
    await request(app.getHttpServer())
      .put('/api/v1/admin/store/hours')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ hours: hours('00:00:00', '23:59:59') })
      .expect(200);

    const updated = await request(app.getHttpServer())
      .put('/api/v1/admin/store')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Loja Atualizada',
        phone: '11988887777',
        address: address('Santos'),
        minimumOrderCents: 2500,
        isManuallyClosed: false,
      })
      .expect(200);
    expect(updated.body).toMatchObject({
      name: 'Loja Atualizada',
      phone: '11988887777',
      minimumOrderCents: 2500,
      isManuallyClosed: false,
      timezone: 'America/Sao_Paulo',
    });
    expect(updated.body.tenantId).toBeUndefined();

    const open = await request(app.getHttpServer())
      .get('/api/v1/public/store')
      .set('X-Tenant-Host', `${owner.tenantSlug}.localhost`)
      .expect(200);
    expect(open.body.name).toBe('Loja Atualizada');
    expect(open.body.minimumOrderCents).toBe(2500);
    expect(open.body.isOpen).toBe(true);

    await request(app.getHttpServer())
      .put('/api/v1/admin/store')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Loja Atualizada',
        phone: '11988887777',
        address: address('Santos'),
        minimumOrderCents: 2500,
        isManuallyClosed: true,
      })
      .expect(200);
    const closed = await request(app.getHttpServer())
      .get('/api/v1/public/store')
      .set('X-Tenant-Host', `${owner.tenantSlug}.localhost`)
      .expect(200);
    expect(closed.body.isManuallyClosed).toBe(true);
    expect(closed.body.isOpen).toBe(false);
  });

  it('lets the owner save a custom domain used as the public host', async () => {
    const owner = await createOwner('loja-dominio', 'Loja Dominio');
    const domain = `pedidos-${randomBytes(3).toString('hex')}.example.com`;
    const saved = await request(app.getHttpServer())
      .put('/api/v1/admin/domain')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ customDomain: domain })
      .expect(200);
    expect(saved.body.customDomain).toBe(domain);

    const published = await request(app.getHttpServer())
      .get('/api/v1/public/store')
      .set('X-Tenant-Host', domain)
      .expect(200);
    expect(published.body.slug).toBe(owner.tenantSlug);
    expect(published.body.name).toBe('Loja Dominio');
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
    await publishStoreForTests(app, tenant.body.id as string);
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
    return { token: login.body.accessToken as string, tenantSlug };
  }
});
