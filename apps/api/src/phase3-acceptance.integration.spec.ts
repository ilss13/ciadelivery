import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { loadEnvFile } from '@ciadelivery/shared';
import Redis from 'ioredis';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createApiApplication } from './bootstrap';

const envSnapshot = { ...process.env };
const demoPassword = 'DemoOwner123';

interface StoreSnapshot {
  name: string;
  phone: string;
  address: {
    line: string;
    number: string;
    district: string;
    city: string;
    state: string;
    postalCode: string;
  };
  minimumOrderCents: number;
  isManuallyClosed: boolean;
}

interface HourSnapshot {
  weekday: number;
  opensAt: string;
  closesAt: string;
  closed: boolean;
}

interface MenuOption {
  id: string;
  name: string;
  priceCents: number;
}

interface MenuProduct {
  id: string;
  name: string;
  priceCents: number;
  optionGroups: Array<{
    name: string;
    options: MenuOption[];
  }>;
}

function openWeek(): HourSnapshot[] {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    opensAt: '00:00:00',
    closesAt: '23:59:59',
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

describe('phase 3 acceptance', () => {
  let app!: INestApplication;
  let token = '';
  let tenantId = '';
  let storeSnapshot: StoreSnapshot | null = null;
  let hourSnapshot: HourSnapshot[] | null = null;
  let originalPrice: number | null = null;
  let productId = '';

  beforeAll(async () => {
    loadEnvFile();
    process.env['NODE_ENV'] = 'local';
    process.env['JWT_ACCESS_SECRET'] =
      process.env['JWT_ACCESS_SECRET'] ??
      'local-development-jwt-access-secret';
    process.env['SEED_PLATFORM_ADMIN'] = 'true';
    process.env['PLATFORM_ADMIN_EMAIL'] = 'platform-admin@ciadelivery.test';
    process.env['PLATFORM_ADMIN_PASSWORD'] = 'PlatformAdmin1';
    process.env['SEED_DEMO'] = 'true';
    process.env['DEMO_OWNER_PASSWORD'] = demoPassword;
    process.env['LOG_PASSWORD_RESET'] = 'false';
    app = await createApiApplication();
    await app.init();
    await clearLoginRateLimits();
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'pizzariadoze-owner@example.com',
        password: demoPassword,
      })
      .expect(200);
    token = login.body.accessToken as string;
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    tenantId = me.body.tenantId as string;
    const store = await request(app.getHttpServer())
      .get('/api/v1/admin/store')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    storeSnapshot = {
      name: store.body.name as string,
      phone: store.body.phone as string,
      address: store.body.address as StoreSnapshot['address'],
      minimumOrderCents: store.body.minimumOrderCents as number,
      isManuallyClosed: store.body.isManuallyClosed as boolean,
    };
    const hours = await request(app.getHttpServer())
      .get('/api/v1/admin/store/hours')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    hourSnapshot = hours.body.hours as HourSnapshot[];
  });

  afterAll(async () => {
    if (app !== undefined) {
      if (token.length > 0 && originalPrice !== null && productId.length > 0) {
        await request(app.getHttpServer())
          .patch(`/api/v1/admin/products/${productId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ priceCents: originalPrice });
      }
      if (token.length > 0 && storeSnapshot !== null) {
        await request(app.getHttpServer())
          .put('/api/v1/admin/store')
          .set('Authorization', `Bearer ${token}`)
          .send(storeSnapshot);
      }
      if (token.length > 0 && hourSnapshot !== null) {
        await request(app.getHttpServer())
          .put('/api/v1/admin/store/hours')
          .set('Authorization', `Bearer ${token}`)
          .send({
            hours: hourSnapshot.map((day) => ({
              weekday: day.weekday,
              opensAt: day.opensAt,
              closesAt: day.closesAt,
              closed: day.closed,
            })),
          });
      }
      await app.close();
    }

    for (const key of Object.keys(process.env)) {
      if (!(key in envSnapshot)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, envSnapshot);
  });

  it('creates a delivery order without signup and keeps the price snapshot', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/admin/store/hours')
      .set('Authorization', `Bearer ${token}`)
      .send({ hours: openWeek() })
      .expect(200);
    if (storeSnapshot === null) {
      throw new Error('Store snapshot is missing');
    }
    await request(app.getHttpServer())
      .put('/api/v1/admin/store')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...storeSnapshot, minimumOrderCents: 0, isManuallyClosed: false })
      .expect(200);

    const menu = await request(app.getHttpServer())
      .get('/api/v1/public/products')
      .query({ page: 1, pageSize: 100 })
      .set('X-Tenant-Host', 'pizzariadoze.localhost')
      .expect(200);
    const calabresa = (menu.body.data as MenuProduct[]).find(
      (product) => product.name === 'Calabresa',
    );
    if (calabresa === undefined) {
      throw new Error('Calabresa was not seeded');
    }
    productId = calabresa.id;
    originalPrice = calabresa.priceCents;
    const grande = optionId(calabresa, 'Tamanho', 'Grande');
    const borda = optionId(calabresa, 'Adicionais', 'Borda');
    const dataSource = app.get(DataSource);
    const ordersBefore = await countOrders(dataSource, tenantId);

    const key = randomUUID();
    const payload = {
      customer: { name: 'Ana', phone: '11988887777' },
      fulfillment: 'DELIVERY',
      address: {
        line: 'Rua A',
        number: '10',
        district: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        postalCode: '01001000',
        complement: null,
      },
      paymentMethodCode: 'CASH',
      notes: null,
      consents: {
        operational: true,
        marketing: false,
        policyVersion: '2026-10-02',
      },
      items: [
        {
          productId: calabresa.id,
          quantity: 1,
          optionIds: [grande, borda],
        },
      ],
    };

    const created = await request(app.getHttpServer())
      .post('/api/v1/public/orders')
      .set('X-Tenant-Host', 'pizzariadoze.localhost')
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);
    expect(created.headers['authorization']).toBeUndefined();
    expect(created.body.status).toBe('NEW');
    expect(created.body.trackingToken).toEqual(expect.any(String));
    expect(created.body.orderId).toEqual(expect.any(String));

    const loaded = await request(app.getHttpServer())
      .get(`/api/v1/public/orders/${created.body.trackingToken as string}`)
      .expect(200);
    expect(loaded.body.totalCents).toBe(created.body.totalCents);
    expect(loaded.body.items[0].options).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Borda' })]),
    );

    const replay = await request(app.getHttpServer())
      .post('/api/v1/public/orders')
      .set('X-Tenant-Host', 'pizzariadoze.localhost')
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);
    expect(replay.body.orderId).toBe(created.body.orderId);
    expect(await countOrders(dataSource, tenantId)).toBe(ordersBefore + 1);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/products/${calabresa.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ priceCents: calabresa.priceCents + 500 })
      .expect(200);
    const frozen = await request(app.getHttpServer())
      .get(`/api/v1/public/orders/${created.body.trackingToken as string}`)
      .expect(200);
    expect(frozen.body.items[0].unitPriceCents).toBe(calabresa.priceCents);
  });
});

function optionId(product: MenuProduct, groupName: string, optionName: string): string {
  const group = product.optionGroups.find((candidate) => candidate.name === groupName);
  const option = group?.options.find((candidate) => candidate.name === optionName);
  if (option === undefined) {
    throw new Error(`${groupName} / ${optionName} was not seeded`);
  }
  return option.id;
}

async function countOrders(dataSource: DataSource, tenantId: string): Promise<number> {
  const rows: Array<{ total: number | string }> = await dataSource.query(
    'SELECT COUNT(*) AS total FROM `orders` WHERE tenant_id = ?',
    [tenantId],
  );
  return Number(rows[0]?.total ?? 0);
}
