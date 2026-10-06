import { randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { DOMAIN_EVENTS, DomainEventPublisher } from '@ciadelivery/orders';
import {
  DomainException,
  GEOCODING,
  GeocodingProvider,
  isStubGeocoding,
  loadEnvFile,
} from '@ciadelivery/shared';
import { UNIT_OF_WORK, UnitOfWork } from '@ciadelivery/tenancy';
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

  it('creates an order without an account and keeps the price snapshot', async () => {
    const ownerA = await createOwner('pedidos-a', 'Pedidos A');
    const ownerB = await createOwner('pedidos-b', 'Pedidos B');
    const catalog = await createProduct(ownerA.token);
    await openStore(ownerA.token);
    const dataSource = app.get(DataSource);
    await dataSource.query(
      `UPDATE delivery_configs SET delivery_enabled = 0, flat_fee_cents = 650 WHERE tenant_id = ?`,
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
      `UPDATE delivery_configs SET delivery_enabled = 1 WHERE tenant_id = ?`,
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
    expect(ownOrder.body.customerName).toBe('Ana');
    expect(ownOrder.body.paymentMethodCode).toBe('CASH');
    expect(ownOrder.body.subtotalCents).toBe(4990);
    expect(ownOrder.body.deliveryFeeCents).toBe(650);
    expect(ownOrder.body.totalCents).toBe(5640);
    expect(ownOrder.body.items).toEqual([
      expect.objectContaining({
        productName: 'Margherita',
        subtotalCents: 4990,
      }),
    ]);
    expect(ownOrder.body.history).toEqual([
      expect.objectContaining({ toStatus: 'NEW', actorType: 'CUSTOMER' }),
    ]);
    const acceptedOnly = await request(app.getHttpServer())
      .get('/api/v1/admin/orders')
      .query({ status: 'ACCEPTED' })
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    expect(acceptedOnly.body.data).toEqual([]);
    const createdOnly = await request(app.getHttpServer())
      .get('/api/v1/admin/orders')
      .query({
        status: 'NEW',
        from: '2000-01-01T00:00:00.000Z',
        to: '2100-01-01T00:00:00.000Z',
      })
      .set('Authorization', `Bearer ${ownerA.token}`)
      .expect(200);
    expect(createdOnly.body.data).toEqual([
      expect.objectContaining({
        id: created.body.orderId,
        customerName: 'Ana',
        status: 'NEW',
      }),
    ]);
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
        address: expect.objectContaining({
          ...deliveryAddress(),
          latitude: expect.any(Number),
          longitude: expect.any(Number),
        }),
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

  it('records an outbox event with the order and advances status in the same transaction', async () => {
    const owner = await createOwner('outbox-a', 'Outbox A');
    const other = await createOwner('outbox-b', 'Outbox B');
    const catalog = await createProduct(owner.token);
    await openStore(owner.token);
    const dataSource = app.get(DataSource);
    const payload = orderBody(catalog, {
      fulfillment: 'PICKUP',
      includeAddress: false,
    });
    const idempotencyKey = randomUUID();
    const created = await postOrder(owner.tenantSlug, payload, idempotencyKey);
    expect(created.status).toBe(201);
    const orderId = created.body.orderId as string;
    const pending = await outboxRows(dataSource, orderId);
    expect(pending).toEqual([
      expect.objectContaining({ type: 'order.created', status: 'PENDING' }),
    ]);
    expect(JSON.stringify(pending[0]?.payload)).not.toContain(
      created.body.trackingToken as string,
    );

    const replay = await postOrder(owner.tenantSlug, payload, idempotencyKey);
    expect(replay.status).toBe(201);
    expect(await outboxRows(dataSource, orderId)).toHaveLength(1);

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    const accepted = await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${orderId}/accept`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(accepted.body.status).toBe('ACCEPTED');
    const again = await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${orderId}/accept`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(409);
    expect(again.body.error.code).toBe('ORDER_INVALID_TRANSITION');
    expect(await outboxRows(dataSource, orderId)).toEqual([
      expect.objectContaining({ type: 'order.created' }),
      expect.objectContaining({ type: 'order.accepted', status: 'PENDING' }),
    ]);

    const history: Array<{
      actor_type: string;
      actor_id: string | null;
      to_status: string;
    }> = await dataSource.query(
      `SELECT actor_type, actor_id, to_status
       FROM order_status_history
       WHERE order_id = ?
       ORDER BY created_at ASC`,
      [orderId],
    );
    expect(history[1]).toEqual({
      actor_type: 'USER',
      actor_id: me.body.id,
      to_status: 'ACCEPTED',
    });

    const foreign = await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${orderId}/reject`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ note: 'nao' })
      .expect(404);
    expect(foreign.body.error.code).toBe('ORDER_NOT_FOUND');
    expect(await outboxRows(dataSource, orderId)).toHaveLength(2);

    const kitchenEmail = `kitchen-${randomBytes(3).toString('hex')}@example.com`;
    emails.push(kitchenEmail);
    await request(app.getHttpServer())
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Cozinha',
        email: kitchenEmail,
        password: 'KitchenPassword1',
        role: 'KITCHEN',
      })
      .expect(201);
    const kitchen = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: kitchenEmail, password: 'KitchenPassword1' })
      .expect(200);
    const forbidden = await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${kitchen.body.accessToken as string}`)
      .send({ note: 'nao pode' })
      .expect(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');

    const prepared = await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${orderId}/start-preparation`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(prepared.body.status).toBe('IN_PREPARATION');
    const ready = await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${orderId}/ready`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(ready.body.status).toBe('READY');
    const delivered = await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${orderId}/complete-pickup`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(delivered.body.status).toBe('DELIVERED');
    expect(await outboxRows(dataSource, orderId)).toEqual([
      expect.objectContaining({ type: 'order.created' }),
      expect.objectContaining({ type: 'order.accepted' }),
      expect.objectContaining({ type: 'order.in_preparation' }),
      expect.objectContaining({ type: 'order.ready' }),
      expect.objectContaining({ type: 'order.delivered' }),
    ]);

    const delivery = await postOrder(
      owner.tenantSlug,
      orderBody(catalog, { fulfillment: 'DELIVERY' }),
    );
    expect(delivery.status).toBe(201);
    const deliveryId = delivery.body.orderId as string;
    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${deliveryId}/accept`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${deliveryId}/start-preparation`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${deliveryId}/ready`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    const courier = await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${deliveryId}/complete-pickup`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(409);
    expect(courier.body.error.code).toBe('DELIVERY_REQUIRES_COURIER');
    const deliveryEvents = await outboxRows(dataSource, deliveryId);
    expect(deliveryEvents.map((row) => row.type)).not.toContain('order.delivered');

    const rejected = await postOrder(
      owner.tenantSlug,
      orderBody(catalog, {
        fulfillment: 'PICKUP',
        includeAddress: false,
        customer: { name: 'Bia', phone: '11977776666' },
      }),
    );
    const reject = await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${rejected.body.orderId as string}/reject`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ note: 'sem estoque' })
      .expect(200);
    expect(reject.body.status).toBe('REJECTED');

    const cancelled = await postOrder(
      owner.tenantSlug,
      orderBody(catalog, {
        fulfillment: 'PICKUP',
        includeAddress: false,
        customer: { name: 'Caio', phone: '11966665555' },
      }),
    );
    const missingNote = await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${cancelled.body.orderId as string}/cancel`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({})
      .expect(400);
    expect(missingNote.body.error.code).toBe('VALIDATION_ERROR');
    const cancel = await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${cancelled.body.orderId as string}/cancel`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ note: 'cliente desistiu' })
      .expect(200);
    expect(cancel.body.status).toBe('CANCELLED');
    const notes: Array<{ note: string | null; to_status: string }> =
      await dataSource.query(
        `SELECT note, to_status FROM order_status_history WHERE order_id = ? AND to_status = 'CANCELLED'`,
        [cancelled.body.orderId],
      );
    expect(notes).toEqual([{ note: 'cliente desistiu', to_status: 'CANCELLED' }]);
    expect(await outboxRows(dataSource, cancelled.body.orderId as string)).toEqual([
      expect.objectContaining({ type: 'order.created' }),
      expect.objectContaining({ type: 'order.cancelled' }),
    ]);
  });

  it('rolls back the outbox when the order transaction fails', async () => {
    const owner = await createOwner('outbox-rollback', 'Outbox Rollback');
    const catalog = await createProduct(owner.token);
    await openStore(owner.token);
    const dataSource = app.get(DataSource);
    const denied = await postOrder(
      owner.tenantSlug,
      orderBody(catalog, {
        fulfillment: 'PICKUP',
        includeAddress: false,
        consents: {
          operational: false,
          marketing: false,
          policyVersion: '2026-10-02',
        },
      }),
    );
    expect(denied.status).toBe(400);
    expect(denied.body.error.code).toBe('CONSENT_REQUIRED');
    const rows: unknown[] = await dataSource.query(
      `SELECT id FROM outbox_events WHERE tenant_id = ?`,
      [owner.tenantId],
    );
    expect(rows).toEqual([]);

    const events = app.get<DomainEventPublisher>(DOMAIN_EVENTS);
    const unitOfWork = app.get<UnitOfWork>(UNIT_OF_WORK);
    const eventId = randomUUID();
    await expect(
      unitOfWork.run(async (tx) => {
        await events.publish(
          {
            id: eventId,
            tenantId: owner.tenantId,
            aggregateType: 'order',
            aggregateId: randomUUID(),
            type: 'order.created',
            availableAt: new Date(),
            payload: {
              orderId: randomUUID(),
              orderNumber: 1,
              storeId: randomUUID(),
              status: 'NEW',
              fulfillment: 'PICKUP',
              occurredAt: new Date().toISOString(),
            },
          },
          tx,
        );
        throw new DomainException(
          'CONSENT_REQUIRED',
          'Operational consent is required',
          400,
        );
      }),
    ).rejects.toBeInstanceOf(DomainException);
    const leaked: unknown[] = await dataSource.query(
      `SELECT id FROM outbox_events WHERE id = ?`,
      [eventId],
    );
    expect(leaked).toEqual([]);
  });

  it('requeues a failed outbox event only for a platform admin', async () => {
    const owner = await createOwner('outbox-requeue', 'Outbox Requeue');
    const dataSource = app.get(DataSource);
    const eventId = randomUUID();
    const now = new Date();
    await dataSource.query(
      `INSERT INTO outbox_events (
         id, tenant_id, aggregate_type, aggregate_id, type, payload, status,
         attempts, available_at, processed_at, last_error, locked_by, created_at
       ) VALUES (?, ?, 'order', ?, 'order.created', ?, 'FAILED', 5, ?, NULL, 'failed', NULL, ?)`,
      [
        eventId,
        owner.tenantId,
        randomUUID(),
        JSON.stringify({ orderId: randomUUID(), status: 'NEW' }),
        now,
        now,
      ],
    );
    const admin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(200);
    const denied = await request(app.getHttpServer())
      .post(`/api/v1/platform/outbox/${eventId}/requeue`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
    const requeued = await request(app.getHttpServer())
      .post(`/api/v1/platform/outbox/${eventId}/requeue`)
      .set('Authorization', `Bearer ${admin.body.accessToken as string}`)
      .expect(200);
    expect(requeued.body).toEqual({ id: eventId, status: 'PENDING' });
    const stored: Array<{ status: string; attempts: number | string }> =
      await dataSource.query(
        `SELECT status, attempts FROM outbox_events WHERE id = ?`,
        [eventId],
      );
    expect(stored[0]?.status).toBe('PENDING');
    expect(Number(stored[0]?.attempts)).toBe(0);
    const second = await request(app.getHttpServer())
      .post(`/api/v1/platform/outbox/${eventId}/requeue`)
      .set('Authorization', `Bearer ${admin.body.accessToken as string}`)
      .expect(409);
    expect(second.body.error.code).toBe('OUTBOX_NOT_FAILED');
    const missing = await request(app.getHttpServer())
      .post(`/api/v1/platform/outbox/${randomUUID()}/requeue`)
      .set('Authorization', `Bearer ${admin.body.accessToken as string}`)
      .expect(404);
    expect(missing.body.error.code).toBe('OUTBOX_NOT_FOUND');
  });

  it('quotes a zone fee, blocks an address outside the area, and keeps the saved fee', async () => {
    const geocoding = app.get<GeocodingProvider>(GEOCODING);
    if (!isStubGeocoding(geocoding)) {
      throw new Error('Expected the stub geocoding provider');
    }
    geocoding.clear();
    const owner = await createOwner('faixa', 'Faixa');
    const catalog = await createProduct(owner.token);
    await openStore(owner.token);
    const dataSource = app.get(DataSource);
    const config = await request(app.getHttpServer())
      .get('/api/v1/admin/delivery/config')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    const originLatitude = Number(config.body.originLatitude);
    const originLongitude = Number(config.body.originLongitude);
    expect(Number.isFinite(originLatitude)).toBe(true);
    const inside = {
      latitude: originLatitude + 2 / 111.195,
      longitude: originLongitude,
    };
    const outside = {
      latitude: originLatitude + 0.2,
      longitude: originLongitude,
    };
    const insideAddress = {
      ...deliveryAddress(),
      line: 'Rua Perto',
      number: '20',
    };
    const outsideAddress = {
      ...deliveryAddress(),
      line: 'Rua Longe',
      number: '900',
    };
    const missingAddress = {
      ...deliveryAddress(),
      line: 'Rua Nenhuma',
      number: '0',
    };
    geocoding.register(insideAddress, inside);
    geocoding.register(outsideAddress, outside);
    geocoding.register(missingAddress, null);

    await request(app.getHttpServer())
      .put('/api/v1/admin/delivery/config')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        deliveryEnabled: true,
        pickupEnabled: true,
        maxRadiusKm: 8,
        feeMode: 'ZONE',
        flatFeeCents: 0,
        estimatedMinutes: 40,
        zones: [
          { fromKm: 0, toKm: 3, feeCents: 500 },
          { fromKm: 3, toKm: 5, feeCents: 700 },
          { fromKm: 5, toKm: 8, feeCents: 1000 },
        ],
      })
      .expect(200);

    const accepted = await request(app.getHttpServer())
      .post('/api/v1/public/delivery/quote')
      .set('X-Tenant-Host', `${owner.tenantSlug}.localhost`)
      .send({ fulfillment: 'DELIVERY', address: insideAddress })
      .expect(200);
    expect(accepted.body.accepted).toBe(true);
    expect(accepted.body.feeCents).toBe(500);
    expect(accepted.body.estimatedMinutes).toBe(40);
    expect(accepted.body.distanceKm).toBeGreaterThan(1.5);
    expect(accepted.body.distanceKm).toBeLessThan(2.5);

    const refused = await request(app.getHttpServer())
      .post('/api/v1/public/delivery/quote')
      .set('X-Tenant-Host', `${owner.tenantSlug}.localhost`)
      .send({ fulfillment: 'DELIVERY', address: outsideAddress })
      .expect(200);
    expect(refused.body).toEqual(
      expect.objectContaining({
        accepted: false,
        reason: 'OUT_OF_AREA',
        feeCents: 0,
      }),
    );

    const ordersBefore = await count(dataSource, 'orders', owner.tenantId);
    const blocked = await postOrder(
      owner.tenantSlug,
      orderBody(catalog, { fulfillment: 'DELIVERY', address: outsideAddress }),
    );
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.code).toBe('OUT_OF_AREA');
    const unknown = await postOrder(
      owner.tenantSlug,
      orderBody(catalog, { fulfillment: 'DELIVERY', address: missingAddress }),
    );
    expect(unknown.status).toBe(422);
    expect(unknown.body.error.code).toBe('ADDRESS_NOT_FOUND');
    expect(await count(dataSource, 'orders', owner.tenantId)).toBe(ordersBefore);

    const created = await postOrder(
      owner.tenantSlug,
      orderBody(catalog, { fulfillment: 'DELIVERY', address: insideAddress }),
    );
    expect(created.status).toBe(201);
    const saved: Array<{
      delivery_fee_cents: number | string;
      address_snapshot: { latitude?: number } | string;
    }> = await dataSource.query(
      `SELECT delivery_fee_cents, address_snapshot FROM orders WHERE id = ?`,
      [created.body.orderId],
    );
    expect(Number(saved[0]?.delivery_fee_cents)).toBe(500);
    const snapshot = readSnapshot(saved[0]?.address_snapshot);
    expect(snapshot.latitude).toBeCloseTo(inside.latitude, 4);
    const addresses: Array<{ latitude: number | string | null }> =
      await dataSource.query(
        `SELECT latitude FROM customer_addresses WHERE tenant_id = ?`,
        [owner.tenantId],
      );
    expect(Number(addresses[0]?.latitude)).toBeCloseTo(inside.latitude, 4);

    const zones = await request(app.getHttpServer())
      .get('/api/v1/admin/delivery/zones')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    const near = (zones.body.zones as Array<{ id: string; fromKm: number }>).find(
      (zone) => zone.fromKm === 0,
    );
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/delivery/zones/${near?.id ?? ''}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ feeCents: 900 })
      .expect(200);
    const frozen = await request(app.getHttpServer())
      .get(`/api/v1/public/orders/${created.body.trackingToken as string}`)
      .expect(200);
    expect(frozen.body.deliveryFeeCents).toBe(500);
    geocoding.clear();
  });

  it('creates one daily test order without adding report revenue', async () => {
    const owner = await createOwner('pedido-teste', 'Pedido Teste');
    await createProduct(owner.token);

    const first = await request(app.getHttpServer())
      .post('/api/v1/admin/orders/test')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({})
      .expect(200);
    const repeated = await request(app.getHttpServer())
      .post('/api/v1/admin/orders/test')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({})
      .expect(200);
    expect(repeated.body.id).toBe(first.body.id);
    expect(first.body).toEqual(
      expect.objectContaining({
        status: 'NEW',
        fulfillment: 'PICKUP',
        source: 'TEST',
        notes: 'TEST_ORDER',
      }),
    );

    const dataSource = app.get(DataSource);
    const stored: Array<{
      source: string;
      notes: string | null;
      customerPhone: string;
      optionsSnapshot: unknown;
    }> = await dataSource.query(
      `SELECT o.source,
              o.notes,
              o.customer_phone AS customerPhone,
              oi.options_snapshot AS optionsSnapshot
         FROM orders o
         INNER JOIN order_items oi ON oi.order_id = o.id
        WHERE o.id = ?`,
      [first.body.id],
    );
    expect(stored[0]).toEqual(
      expect.objectContaining({
        source: 'TEST',
        notes: 'TEST_ORDER',
        customerPhone: '5500000000000',
      }),
    );
    const options =
      typeof stored[0]?.optionsSnapshot === 'string'
        ? JSON.parse(stored[0].optionsSnapshot)
        : stored[0]?.optionsSnapshot;
    expect(options).toEqual([
      expect.objectContaining({ name: 'Grande', priceCents: 1000 }),
    ]);

    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const overview = await request(app.getHttpServer())
      .get('/api/v1/admin/reports/overview')
      .query({ from: today, to: today })
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(overview.body.orderCount).toBe(0);
    expect(overview.body.revenueCents).toBe(0);

    const onboarding = await request(app.getHttpServer())
      .get('/api/v1/admin/onboarding')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(onboarding.body.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'place_test_order', status: 'DONE' }),
      ]),
    );
  });

  async function outboxRows(
    dataSource: DataSource,
    orderId: string,
  ): Promise<Array<{ type: string; status: string; payload: unknown }>> {
    return dataSource.query(
      `SELECT type, status, payload
       FROM outbox_events
       WHERE aggregate_id = ?
       ORDER BY created_at ASC, id ASC`,
      [orderId],
    );
  }

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

function readSnapshot(value: { latitude?: number } | string | undefined): {
  latitude?: number;
} {
  if (value === undefined) {
    return {};
  }
  if (typeof value === 'string') {
    return JSON.parse(value) as { latitude?: number };
  }
  return value;
}

function orderBody(
  catalog: { productId: string; optionId: string },
  patch: {
    fulfillment?: 'DELIVERY' | 'PICKUP';
    includeAddress?: boolean;
    address?: ReturnType<typeof deliveryAddress>;
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
    ...(includeAddress ? { address: patch.address ?? deliveryAddress() } : {}),
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
