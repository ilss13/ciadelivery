import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { loadEnvFile } from '@ciadelivery/shared';
import Redis from 'ioredis';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createApiApplication } from './bootstrap';

const envSnapshot = { ...process.env };
const storageDir = mkdtempSync(join(tmpdir(), 'ciadelivery-api-media-'));
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
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

describe('catalog categories, products and options', () => {
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
    process.env['STORAGE_DRIVER'] = 'local';
    process.env['STORAGE_LOCAL_DIR'] = storageDir;
    process.env['STORAGE_PUBLIC_BASE_URL'] = 'http://localhost:3000';
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
    rmSync(storageDir, { recursive: true, force: true });
  });

  it('publishes a menu only on the tenant host and hides inactive products', async () => {
    const ownerA = await createOwner('cardapio-a', 'Cardapio A');
    const ownerB = await createOwner('cardapio-b', 'Cardapio B');

    const category = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ name: 'Pizzas', description: 'Forno', active: true })
      .expect(201);
    const product = await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({
        categoryId: category.body.id,
        name: 'Margherita',
        description: 'Molho e mussarela',
        priceCents: 3990,
        active: true,
        available: true,
      })
      .expect(201);
    const size = await request(app.getHttpServer())
      .post(`/api/v1/admin/products/${product.body.id as string}/option-groups`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ name: 'Tamanho', minSelect: 1, maxSelect: 1 })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/api/v1/admin/products/${product.body.id as string}/option-groups/${size.body.id as string}/options`,
      )
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ name: 'Grande', priceCents: 1000, available: true })
      .expect(201);
    const extras = await request(app.getHttpServer())
      .post(`/api/v1/admin/products/${product.body.id as string}/option-groups`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ name: 'Adicionais', minSelect: 0, maxSelect: 3 })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/api/v1/admin/products/${product.body.id as string}/option-groups/${extras.body.id as string}/options`,
      )
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ name: 'Borda', priceCents: 500, available: false })
      .expect(201);

    const hidden = await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({
        categoryId: category.body.id,
        name: 'Calabresa secreta',
        priceCents: 100,
        active: false,
        available: true,
      })
      .expect(201);

    const published = await request(app.getHttpServer())
      .get('/api/v1/public/products')
      .query({ page: 1, pageSize: 20 })
      .set('X-Tenant-Host', `${ownerA.tenantSlug}.localhost`)
      .expect(200);
    expect(published.body.data).toEqual([
      expect.objectContaining({
        id: product.body.id,
        name: 'Margherita',
        priceCents: 3990,
        optionGroups: expect.arrayContaining([
          expect.objectContaining({
            name: 'Tamanho',
            minSelect: 1,
            maxSelect: 1,
            options: [expect.objectContaining({ name: 'Grande', priceCents: 1000 })],
          }),
          expect.objectContaining({
            name: 'Adicionais',
            minSelect: 0,
            maxSelect: 3,
            options: [
              expect.objectContaining({
                name: 'Borda',
                priceCents: 500,
                available: false,
              }),
            ],
          }),
        ]),
      }),
    ]);
    expect(JSON.stringify(published.body)).not.toContain('Calabresa secreta');
    expect(JSON.stringify(published.body)).not.toContain(ownerB.tenantSlug);

    const otherHost = await request(app.getHttpServer())
      .get('/api/v1/public/products')
      .set('X-Tenant-Host', `${ownerB.tenantSlug}.localhost`)
      .expect(200);
    expect(otherHost.body.data).toEqual([]);

    const foreign = await request(app.getHttpServer())
      .get(`/api/v1/admin/products/${product.body.id as string}`)
      .set('Authorization', `Bearer ${ownerB.token}`)
      .expect(404);
    expect(foreign.body.error.code).toBe('PRODUCT_NOT_FOUND');

    const publicForeign = await request(app.getHttpServer())
      .get(`/api/v1/public/products/${product.body.id as string}`)
      .set('X-Tenant-Host', `${ownerB.tenantSlug}.localhost`)
      .expect(404);
    expect(publicForeign.body.error.code).toBe('PRODUCT_NOT_FOUND');

    const inactive = await request(app.getHttpServer())
      .get(`/api/v1/public/products/${hidden.body.id as string}`)
      .set('X-Tenant-Host', `${ownerA.tenantSlug}.localhost`)
      .expect(404);
    expect(inactive.body.error.code).toBe('PRODUCT_NOT_FOUND');

    const blocked = await request(app.getHttpServer())
      .delete(`/api/v1/admin/categories/${category.body.id as string}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(409);
    expect(blocked.body.error.code).toBe('CATEGORY_NOT_EMPTY');

    const ignoredTenant = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ name: 'Massas', tenantId: ownerB.tenantId })
      .expect(400);
    expect(ignoredTenant.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('stores a product image on the tenant prefix and ignores a foreign key', async () => {
    const ownerA = await createOwner('imagem-a', 'Imagem A');
    const ownerB = await createOwner('imagem-b', 'Imagem B');
    const categoryA = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ name: 'Pizzas' })
      .expect(201);
    const productA = await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({
        categoryId: categoryA.body.id,
        name: 'Margherita',
        priceCents: 3990,
      })
      .expect(201);
    const categoryB = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${ownerB.token}`)
      .send({ name: 'Burgers' })
      .expect(201);
    const productB = await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${ownerB.token}`)
      .send({
        categoryId: categoryB.body.id,
        name: 'Classico',
        priceCents: 2500,
      })
      .expect(201);

    const uploaded = await request(app.getHttpServer())
      .post(`/api/v1/admin/products/${productA.body.id as string}/image`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .attach('file', PNG_1X1, { filename: 'foto.png', contentType: 'image/png' })
      .expect(201);
    expect(uploaded.body.key).toMatch(
      new RegExp(`^${ownerA.tenantId}/products/.+\\.png$`),
    );
    const mediaPath = new URL(uploaded.body.url as string).pathname;
    const media = await request(app.getHttpServer()).get(mediaPath).expect(200);
    expect(media.headers['content-type']).toMatch(/image\/png/);

    const stored = await request(app.getHttpServer())
      .get(`/api/v1/admin/products/${productA.body.id as string}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    expect(stored.body.imageKey).toBe(uploaded.body.key);
    expect(stored.body.imageUrl).toBe(uploaded.body.url);

    const patched = await request(app.getHttpServer())
      .patch(`/api/v1/admin/products/${productB.body.id as string}`)
      .set('Authorization', `Bearer ${ownerB.token}`)
      .send({ name: 'Classico', imageKey: uploaded.body.key })
      .expect(200);
    expect(patched.body.imageKey).toBeNull();
    expect(patched.body.name).toBe('Classico');

    const foreignFile = await request(app.getHttpServer())
      .get(`/media/${ownerB.tenantId}/products/${productA.body.id as string}.png`)
      .expect(404);
    expect(foreignFile.body.error.code).toBe('NOT_FOUND');

    const rejected = await request(app.getHttpServer())
      .post(`/api/v1/admin/products/${productA.body.id as string}/image`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .attach('file', Buffer.from('not a png'), {
        filename: 'note.png',
        contentType: 'image/png',
      })
      .expect(400);
    expect(rejected.body.error.code).toBe('INVALID_FILE');

    const logo = await request(app.getHttpServer())
      .post('/api/v1/admin/branding/logo')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .attach('file', PNG_1X1, { filename: 'logo.png', contentType: 'image/png' })
      .expect(201);
    expect(logo.body.key).toMatch(new RegExp(`^${ownerA.tenantId}/logos/.+\\.png$`));
    const logoMedia = new URL(logo.body.url as string).pathname;
    await request(app.getHttpServer()).get(logoMedia).expect(200);

    await request(app.getHttpServer())
      .put('/api/v1/admin/branding')
      .set('Authorization', `Bearer ${ownerB.token}`)
      .send({
        displayName: 'Imagem B',
        logoUrl: logo.body.url,
        faviconUrl: null,
        bannerUrl: null,
        primaryColor: '#111111',
        secondaryColor: '#FFFFFF',
        accentColor: '#222222',
        fontFamily: null,
        seoTitle: 'Imagem B',
        seoDescription: '',
        instagramUrl: null,
        facebookUrl: null,
        websiteUrl: null,
        contactEmail: null,
        whatsappPhone: null,
      })
      .expect(200);
    const brandingB = await request(app.getHttpServer())
      .get('/api/v1/admin/branding')
      .set('Authorization', `Bearer ${ownerB.token}`)
      .expect(200);
    expect(brandingB.body.logoUrl).toBeNull();
  });

  it('validates a cart on the tenant host and ignores another tenant option', async () => {
    const ownerA = await createOwner('carrinho-a', 'Carrinho A');
    const ownerB = await createOwner('carrinho-b', 'Carrinho B');
    const categoryA = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ name: 'Pizzas' })
      .expect(201);
    const productA = await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({
        categoryId: categoryA.body.id,
        name: 'Margherita',
        priceCents: 3990,
        active: true,
        available: true,
      })
      .expect(201);
    const size = await request(app.getHttpServer())
      .post(`/api/v1/admin/products/${productA.body.id as string}/option-groups`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ name: 'Tamanho', minSelect: 1, maxSelect: 1 })
      .expect(201);
    const grande = await request(app.getHttpServer())
      .post(
        `/api/v1/admin/products/${productA.body.id as string}/option-groups/${size.body.id as string}/options`,
      )
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ name: 'Grande', priceCents: 1000, available: true })
      .expect(201);
    const categoryB = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${ownerB.token}`)
      .send({ name: 'Burgers' })
      .expect(201);
    const productB = await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${ownerB.token}`)
      .send({
        categoryId: categoryB.body.id,
        name: 'Classico',
        priceCents: 2500,
        active: true,
        available: true,
      })
      .expect(201);

    const line = {
      productId: productA.body.id,
      quantity: 2,
      optionIds: [grande.body.id],
      notes: 'sem cebola',
    };
    const closed = await request(app.getHttpServer())
      .post('/api/v1/public/cart/validate')
      .set('X-Tenant-Host', `${ownerA.tenantSlug}.localhost`)
      .send({ items: [line] })
      .expect(200);
    expect(closed.body.subtotalCents).toBe(9980);
    expect(closed.body.items[0]).toEqual(
      expect.objectContaining({
        name: 'Margherita',
        unitPriceCents: 3990,
        subtotalCents: 9980,
        options: [expect.objectContaining({ name: 'Grande', priceCents: 1000 })],
      }),
    );
    expect(closed.body.valid).toBe(false);
    expect(closed.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'STORE_CLOSED', itemIndex: null }),
      ]),
    );

    await request(app.getHttpServer())
      .put('/api/v1/admin/store/hours')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({
        hours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday,
          opensAt: '00:00:00',
          closesAt: '23:59:59',
          closed: false,
        })),
      })
      .expect(200);

    const open = await request(app.getHttpServer())
      .post('/api/v1/public/cart/validate')
      .set('X-Tenant-Host', `${ownerA.tenantSlug}.localhost`)
      .send({ items: [line] })
      .expect(200);
    expect(open.body).toEqual(
      expect.objectContaining({
        subtotalCents: 9980,
        meetsMinimumOrder: true,
        storeOpen: true,
        valid: true,
        errors: [],
      }),
    );

    const foreignProduct = await request(app.getHttpServer())
      .post('/api/v1/public/cart/validate')
      .set('X-Tenant-Host', `${ownerB.tenantSlug}.localhost`)
      .send({ items: [line] })
      .expect(200);
    expect(foreignProduct.body.valid).toBe(false);
    expect(foreignProduct.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PRODUCT_NOT_FOUND', itemIndex: 0 }),
      ]),
    );

    const foreignOption = await request(app.getHttpServer())
      .post('/api/v1/public/cart/validate')
      .set('X-Tenant-Host', `${ownerB.tenantSlug}.localhost`)
      .send({
        items: [
          {
            productId: productB.body.id,
            quantity: 1,
            optionIds: [grande.body.id],
          },
        ],
      })
      .expect(200);
    expect(foreignOption.body.valid).toBe(false);
    expect(foreignOption.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'OPTION_NOT_FOUND', itemIndex: 0 }),
      ]),
    );
    expect(JSON.stringify(foreignOption.body.items)).not.toContain('Grande');

    const malformed = await request(app.getHttpServer())
      .post('/api/v1/public/cart/validate')
      .set('X-Tenant-Host', `${ownerA.tenantSlug}.localhost`)
      .send({
        items: [{ productId: productA.body.id, quantity: 1, optionIds: [], priceCents: 1 }],
      })
      .expect(400);
    expect(malformed.body.error.code).toBe('VALIDATION_ERROR');

    const empty = await request(app.getHttpServer())
      .post('/api/v1/public/cart/validate')
      .set('X-Tenant-Host', `${ownerA.tenantSlug}.localhost`)
      .send({ items: [] })
      .expect(200);
    expect(empty.body.valid).toBe(false);
    expect(empty.body.errors).toEqual([
      expect.objectContaining({ code: 'CART_EMPTY', itemIndex: null }),
    ]);
  });

  it('rejects an attendant creating a category', async () => {
    const owner = await createOwner('cardapio-atendente', 'Cardapio Atendente');
    const attendantEmail = `attendant-${randomBytes(3).toString('hex')}@example.com`;
    emails.push(attendantEmail);
    await request(app.getHttpServer())
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Atendente',
        email: attendantEmail,
        password: 'AttendantPass1',
        role: 'ATTENDANT',
      })
      .expect(201);
    const attendant = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: attendantEmail, password: 'AttendantPass1' })
      .expect(200);
    const denied = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${attendant.body.accessToken as string}`)
      .send({ name: 'Pizzas' })
      .expect(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
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
