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

function deliveryAddress() {
  return {
    line: 'Rua A',
    number: '10',
    district: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '01001000',
    complement: null,
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
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  redis.disconnect();
}

describe('public orders', () => {
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

  it('creates an order without an account and keeps the price snapshot', async () => {
    const ownerA = await createOwner('pedidos-a', 'Pedidos A');
    const ownerB = await createOwner('pedidos-b', 'Pedidos B');
    const catalog = await createProduct(ownerA.token);
    await openStore(ownerA.token);
    const dataSource = app.get(DataSource);
    await dataSource.query(
      `UPDATE stores SET delivery_enabled = 0, delivery_flat_fee_cents = 650 WHERE tenant_id = ?`,
      [ownerA.tenantId],
    );

    const missingKey = await request(app.getHttpServer())
      .post('/api/v1/public/orders')
      .set('X-Tenant-Host', `${ownerA.tenantSlug}.localhost`)
      .send(orderBody(catalog, { fulfillment: 'DELIVERY' }))
      .expect(400);
    expect(missingKey.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');

    const refused = await postOrder(ownerA.tenantSlug, orderBody(catalog, {
      consents: {
        operational: false,
        marketing: false,
        policyVersion: '2026-10-02',
      },
    }));
    expect(refused.status).toBe(400);
    expect(refused.body.error.code).toBe('CONSENT_REQUIRED');
    expect(await count(dataSource, 'customers', ownerA.tenantId)).toBe(0);

    const disabled = await postOrder(
      ownerA.tenantSlug,
      orderBody(catalog, { fulfillment: 'DELIVERY' }),
    );
    expect(disabled.status).toBe(422);
    expect(disabled.body.error.code).toBe('DELIVERY_DISABLED');

    await dataSource.query(
      `UPDATE stores SET delivery_enabled = 1 WHERE tenant_id = ?`,
      [ownerA.tenantId],
    );

    const reviewed = await request(app.getHttpServer())
      .post('/api/v1/public/orders/review')
      .set('X-Tenant-Host', `${ownerA.tenantSlug}.localhost`)
      .send({
        fulfillment: 'DELIVERY',
        address: deliveryAddress(),
        paymentMethodCode: 'CASH',
        items: [
          {
            productId: catalog.productId,
            quantity: 1,
            optionIds: [catalog.optionId],
            notes: null,
          },
        ],
      })
      .expect(200);
    expect(reviewed.body.deliveryFeeCents).toBe(650);
    expect(reviewed.body.totalCents).toBe(5640);
    expect(reviewed.body.paymentLabel).toBe('Dinheiro');
    expect(await count(dataSource, 'orders', ownerA.tenantId)).toBe(0);

    const withoutAddress = await postOrder(
      ownerA.tenantSlug,
      orderBody(catalog, { fulfillment: 'DELIVERY', includeAddress: false }),
    );
    expect(withoutAddress.status).toBe(400);
    expect(withoutAddress.body.error.code).toBe('VALIDATION_ERROR');

    const key = randomUUID();
    const payload = orderBody(catalog, { fulfillment: 'DELIVERY' });
    const created = await postOrder(ownerA.tenantSlug, payload, key);
    expect(created.status).toBe(201);
    expect(created.body).toEqual({
      orderId: created.body.orderId,
      orderNumber: 1,
      status: 'NEW',
      totalCents: 5640,
      trackingToken: created.body.trackingToken,
      trackingPath: `/pedido/${created.body.trackingToken as string}`,
    });
    expect(created.body.trackingToken).toEqual(expect.any(String));
    expect(created.headers['authorization']).toBeUndefined();

    const listed = await request(app.getHttpServer())
      .get('/api/v1/admin/orders')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    expect(listed.body.data).toEqual([
      expect.objectContaining({
        id: created.body.orderId,
        orderNumber: 1,
        totalCents: 5640,
        status: 'NEW',
        fulfillment: 'DELIVERY',
      }),
    ]);
    const ownOrder = await request(app.getHttpServer())
      .get(`/api/v1/admin/orders/${created.body.orderId as string}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    expect(ownOrder.body.trackingToken).toBeUndefined();
    const foreignOrder = await request(app.getHttpServer())
      .get(`/api/v1/admin/orders/${created.body.orderId as string}`)
      .set('Authorization', `Bearer ${ownerB.token}`)
      .expect(404);
    expect(foreignOrder.body.error.code).toBe('ORDER_NOT_FOUND');
    const foreignList = await request(app.getHttpServer())
      .get('/api/v1/admin/orders')
      .set('Authorization', `Bearer ${ownerB.token}`)
      .expect(200);
    expect(foreignList.body.data).toEqual([]);

    const token = created.body.trackingToken as string;
    const loaded = await request(app.getHttpServer())
      .get(`/api/v1/public/orders/${token}`)
      .expect(200);
    expect(loaded.body).toEqual(
      expect.objectContaining({
        orderId: created.body.orderId,
        orderNumber: 1,
        status: 'NEW',
        fulfillment: 'DELIVERY',
        paymentMethodCode: 'CASH',
        paymentLabel: 'Dinheiro',
        customerName: 'Ana',
        customerPhone: '5511988887777',
        subtotalCents: 4990,
        deliveryFeeCents: 650,
        totalCents: 5640,
        address: deliveryAddress(),
      }),
    );
    expect(loaded.body.tenantId).toBeUndefined();
    expect(loaded.body.trackingToken).toBeUndefined();
    expect(loaded.body.items).toEqual([
      expect.objectContaining({
        productId: catalog.productId,
        productName: 'Margherita',
        unitPriceCents: 3990,
        quantity: 1,
        subtotalCents: 4990,
        options: [
          {
            optionId: catalog.optionId,
            groupName: 'Tamanho',
            name: 'Grande',
            priceCents: 1000,
          },
        ],
      }),
    ]);
    expect(loaded.body.history).toEqual([
      expect.objectContaining({
        fromStatus: null,
        toStatus: 'NEW',
        actorType: 'CUSTOMER',
        note: null,
      }),
    ]);

    const withoutHost = await request(app.getHttpServer())
      .get(`/api/v1/public/orders/${token}`)
      .expect(200);
    expect(withoutHost.body.orderId).toBe(created.body.orderId);

    const otherHost = await request(app.getHttpServer())
      .get(`/api/v1/public/orders/${token}`)
      .set('X-Tenant-Host', `${ownerB.tenantSlug}.localhost`)
      .expect(200);
    expect(otherHost.body.orderId).toBe(created.body.orderId);
    expect(JSON.stringify(otherHost.body)).not.toContain('Pedidos B');

    const malformed = await request(app.getHttpServer())
      .get('/api/v1/public/orders/not-a-token')
      .expect(404);
    const unknown = await request(app.getHttpServer())
      .get(`/api/v1/public/orders/${randomUUID()}`)
      .expect(404);
    expect(malformed.body.error.code).toBe('ORDER_NOT_FOUND');
    expect(unknown.body.error.code).toBe('ORDER_NOT_FOUND');

    const replay = await postOrder(ownerA.tenantSlug, payload, key);
    expect(replay.status).toBe(201);
    expect(replay.body).toEqual(created.body);
    expect(await count(dataSource, 'orders', ownerA.tenantId)).toBe(1);

    const conflict = await postOrder(
      ownerA.tenantSlug,
      orderBody(catalog, { fulfillment: 'DELIVERY', notes: 'sem cebola' }),
      key,
    );
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(await count(dataSource, 'orders', ownerA.tenantId)).toBe(1);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/products/${catalog.productId}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ priceCents: 1500 })
      .expect(200);
    await request(app.getHttpServer())
      .patch(
        `/api/v1/admin/option-groups/${catalog.groupId}/options/${catalog.optionId}`,
      )
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ priceCents: 50 })
      .expect(200);

    const frozen = await request(app.getHttpServer())
      .get(`/api/v1/public/orders/${token}`)
      .expect(200);
    expect(frozen.body.items[0].unitPriceCents).toBe(3990);
    expect(frozen.body.items[0].options[0].priceCents).toBe(1000);
    expect(frozen.body.totalCents).toBe(5640);

    const pickup = await postOrder(
      ownerA.tenantSlug,
      orderBody(catalog, { fulfillment: 'PICKUP', includeAddress: false }),
    );
    expect(pickup.status).toBe(201);
    expect(pickup.body.totalCents).toBe(1550);
    const pickupView = await request(app.getHttpServer())
      .get(`/api/v1/public/orders/${pickup.body.trackingToken as string}`)
      .expect(200);
    expect(pickupView.body.fulfillment).toBe('PICKUP');
    expect(pickupView.body.address).toBeNull();
    expect(pickupView.body.deliveryFeeCents).toBe(0);
    expect(pickupView.body.items[0].unitPriceCents).toBe(1500);

    const [first, second] = await Promise.all([
      postOrder(ownerA.tenantSlug, orderBody(catalog, {
        fulfillment: 'PICKUP',
        includeAddress: false,
        customer: { name: 'Bia', phone: '11977776666' },
      })),
      postOrder(ownerA.tenantSlug, orderBody(catalog, {
        fulfillment: 'PICKUP',
        includeAddress: false,
        customer: { name: 'Caio', phone: '11966665555' },
      })),
    ]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.orderNumber).not.toBe(second.body.orderNumber);
  });

  async function count(
    dataSource: DataSource,
    table: 'customers' | 'orders',
    tenantId: string,
  ): Promise<number> {
    const rows: Array<{ total: number | string }> = await dataSource.query(
      `SELECT COUNT(*) AS total FROM \`${table}\` WHERE tenant_id = ?`,
      [tenantId],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async function postOrder(
    tenantSlug: string,
    body: ReturnType<typeof orderBody>,
    key: string = randomUUID(),
  ) {
    return request(app.getHttpServer())
      .post('/api/v1/public/orders')
      .set('X-Tenant-Host', `${tenantSlug}.localhost`)
      .set('Idempotency-Key', key)
      .send(body);
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

  async function createProduct(token: string): Promise<{
    productId: string;
    groupId: string;
    optionId: string;
  }> {
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
    const group = await request(app.getHttpServer())
      .post(`/api/v1/admin/products/${product.body.id as string}/option-groups`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Tamanho', minSelect: 1, maxSelect: 1 })
      .expect(201);
    const option = await request(app.getHttpServer())
      .post(
        `/api/v1/admin/products/${product.body.id as string}/option-groups/${group.body.id as string}/options`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Grande', priceCents: 1000, available: true })
      .expect(201);
    return {
      productId: product.body.id as string,
      groupId: group.body.id as string,
      optionId: option.body.id as string,
    };
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

function orderBody(
  catalog: { productId: string; optionId: string },
  patch: {
    fulfillment?: 'DELIVERY' | 'PICKUP';
    includeAddress?: boolean;
    notes?: string | null;
    customer?: { name: string; phone: string };
    consents?: {
      operational: boolean;
      marketing: boolean;
      policyVersion: string;
    };
  },
) {
  const fulfillment = patch.fulfillment ?? 'DELIVERY';
  const includeAddress = patch.includeAddress ?? fulfillment === 'DELIVERY';
  return {
    customer: patch.customer ?? { name: 'Ana', phone: '11988887777' },
    fulfillment,
    ...(includeAddress ? { address: deliveryAddress() } : {}),
    paymentMethodCode: 'CASH',
    notes: patch.notes === undefined ? null : patch.notes,
    consents: patch.consents ?? {
      operational: true,
      marketing: false,
      policyVersion: '2026-10-02',
    },
    items: [
      {
        productId: catalog.productId,
        quantity: 1,
        optionIds: [catalog.optionId],
        notes: null,
      },
    ],
  };
}
