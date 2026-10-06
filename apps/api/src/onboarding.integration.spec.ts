import { randomBytes } from 'node:crypto';
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

function branding(displayName: string) {
  return {
    displayName,
    logoUrl: null,
    faviconUrl: null,
    bannerUrl: null,
    primaryColor: '#112233',
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

function hours() {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    opensAt: '09:00:00',
    closesAt: '18:00:00',
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

describe('assisted onboarding', () => {
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
    process.env['SEED_DEMO'] = 'false';
    process.env['LOG_PASSWORD_RESET'] = 'false';
    app = await createApiApplication();
    await app.init();
  });

  beforeEach(async () => {
    await clearLoginRateLimits();
  });

  afterAll(async () => {
    if (app === undefined) {
      return;
    }
    const dataSource = app.get(DataSource);
    if (dataSource.isInitialized && createdTenantIds.length > 0) {
      const marks = createdTenantIds.map(() => '?').join(', ');
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
        `DELETE FROM audit_logs WHERE tenant_id IN (${marks})`,
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
    await clearLoginRateLimits();
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('keeps a new store private until the required steps and an active product exist', async () => {
    const owner = await createOwner('implantar', 'Loja Nova');
    const hidden = await request(app.getHttpServer())
      .get('/api/v1/public/store')
      .set('X-Tenant-Host', `${owner.tenantSlug}.localhost`)
      .expect(403);
    expect(hidden.body.error.code).toBe('STORE_UNPUBLISHED');
    expect(hidden.body.branding).toBeUndefined();
    const blockedOrder = await request(app.getHttpServer())
      .post('/api/v1/public/orders')
      .set('X-Tenant-Host', `${owner.tenantSlug}.localhost`)
      .set('Idempotency-Key', `unpublished-${randomBytes(8).toString('hex')}`)
      .send({
        customer: { name: 'Cliente', phone: '11988887777' },
        fulfillment: 'PICKUP',
        address: null,
        paymentMethodCode: 'CASH',
        notes: null,
        consents: {
          operational: true,
          marketing: false,
          policyVersion: 'test-v1',
        },
        items: [
          {
            productId: '00000000-0000-4000-8000-000000000001',
            quantity: 1,
            optionIds: [],
            notes: null,
          },
        ],
      })
      .expect(403);
    expect(blockedOrder.body.error.code).toBe('STORE_UNPUBLISHED');

    const initial = await request(app.getHttpServer())
      .get('/api/v1/admin/onboarding')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(initial.body.published).toBe(false);
    expect(stepStatus(initial.body, 'create_tenant')).toBe('DONE');
    expect(stepStatus(initial.body, 'create_store')).toBe('DONE');
    expect(stepStatus(initial.body, 'configure_hours')).toBe('PENDING');

    await request(app.getHttpServer())
      .put('/api/v1/admin/store/hours')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ hours: hours() })
      .expect(200);
    const afterHours = await request(app.getHttpServer())
      .get('/api/v1/admin/onboarding')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(stepStatus(afterHours.body, 'configure_hours')).toBe('DONE');

    const manual = await request(app.getHttpServer())
      .post('/api/v1/admin/onboarding/configure_hours/complete')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({})
      .expect(409);
    expect(manual.body.error.code).toBe('ONBOARDING_STEP_NOT_MANUAL');

    await request(app.getHttpServer())
      .put('/api/v1/admin/branding')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(branding('Loja Nova'))
      .expect(200);
    await request(app.getHttpServer())
      .put('/api/v1/admin/store')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Loja Nova',
        phone: '11999999999',
        address: address(),
        minimumOrderCents: 0,
        isManuallyClosed: false,
      })
      .expect(200);

    const blocked = await request(app.getHttpServer())
      .post('/api/v1/admin/store/publish')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({})
      .expect(409);
    expect(blocked.body.error.code).toBe('ONBOARDING_INCOMPLETE');
    expect(blocked.body.error.details.codes).toEqual(['import_catalog']);

    const category = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Lanches' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        categoryId: category.body.id,
        name: 'Misto',
        priceCents: 1200,
        active: true,
      })
      .expect(201);

    const trained = await request(app.getHttpServer())
      .post('/api/v1/admin/onboarding/train_team/complete')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ note: 'Equipe treinada no balcão' })
      .expect(200);
    expect(stepStatus(trained.body, 'train_team')).toBe('DONE');

    const published = await request(app.getHttpServer())
      .post('/api/v1/admin/store/publish')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({})
      .expect(200);
    expect(published.body.published).toBe(true);
    expect(stepStatus(published.body, 'publish_store')).toBe('DONE');

    const visible = await request(app.getHttpServer())
      .get('/api/v1/public/store')
      .set('X-Tenant-Host', `${owner.tenantSlug}.localhost`)
      .expect(200);
    expect(visible.body.name).toBe('Loja Nova');
  });

  it('shows each tenant only its own checklist', async () => {
    const first = await createOwner('checklist-a', 'Checklist A');
    const second = await createOwner('checklist-b', 'Checklist B');
    await request(app.getHttpServer())
      .post('/api/v1/admin/onboarding/train_team/skip')
      .set('Authorization', `Bearer ${second.token}`)
      .send({ note: 'nota-secreta-b' })
      .expect(200);

    const own = await request(app.getHttpServer())
      .get('/api/v1/admin/onboarding')
      .set('Authorization', `Bearer ${first.token}`)
      .expect(200);
    expect(JSON.stringify(own.body)).not.toContain('nota-secreta-b');

    const admin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(200);
    const platform = await request(app.getHttpServer())
      .get(`/api/v1/platform/tenants/${second.tenantId}/onboarding`)
      .set('Authorization', `Bearer ${admin.body.accessToken as string}`)
      .expect(200);
    expect(JSON.stringify(platform.body)).toContain('nota-secreta-b');

    const denied = await request(app.getHttpServer())
      .get(`/api/v1/platform/tenants/${second.tenantId}/onboarding`)
      .set('Authorization', `Bearer ${first.token}`)
      .expect(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
  });

  it('shows pilot telemetry only to the super admin', async () => {
    const owner = await createOwner('pilot-status', 'Status Piloto');
    const admin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/api/v1/platform/pilot-status')
      .set('Authorization', `Bearer ${admin.body.accessToken as string}`)
      .expect(200);
    const tenant = response.body.tenants.find(
      (item: { tenantId: string }) => item.tenantId === owner.tenantId,
    );
    expect(tenant).toEqual(
      expect.objectContaining({
        name: 'Status Piloto',
        published: false,
        storefrontOrdersLast7Days: 0,
        failedWhatsAppMessages: 0,
      }),
    );
    expect(tenant.pendingSteps).toContain('configure_branding');
    expect(JSON.stringify(tenant)).not.toContain('body');

    await request(app.getHttpServer())
      .get('/api/v1/platform/pilot-status')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/platform/pilot-status')
      .expect(401);
  });

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
      tenantId: tenant.body.id as string,
    };
  }
});

function stepStatus(
  body: { steps: { code: string; status: string }[] },
  code: string,
): string | undefined {
  return body.steps.find((step) => step.code === code)?.status;
}
