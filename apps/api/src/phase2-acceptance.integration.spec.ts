import { INestApplication } from '@nestjs/common';
import { loadEnvFile } from '@ciadelivery/shared';
import Redis from 'ioredis';
import request from 'supertest';
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
  available: boolean;
  optionGroups: Array<{
    name: string;
    minSelect: number;
    maxSelect: number;
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

describe('phase 2 acceptance', () => {
  let app!: INestApplication;
  let token = '';
  let storeSnapshot: StoreSnapshot | null = null;
  let hourSnapshot: HourSnapshot[] | null = null;

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
      if (token.length > 0 && storeSnapshot !== null) {
        await request(app.getHttpServer())
          .put('/api/v1/admin/store')
          .set('Authorization', `Bearer ${token}`)
          .send(storeSnapshot)
          .expect(200);
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
          })
          .expect(200);
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

  it('accepts a priced pizza cart and rejects the other store, a missing size, a closed store and a short subtotal', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/admin/store/hours')
      .set('Authorization', `Bearer ${token}`)
      .send({ hours: openWeek() })
      .expect(200);
    await saveStore({ minimumOrderCents: 0, isManuallyClosed: false });

    const menu = await request(app.getHttpServer())
      .get('/api/v1/public/products')
      .query({ page: 1, pageSize: 100 })
      .set('X-Tenant-Host', 'pizzariadoze.localhost')
      .expect(200);
    const products = menu.body.data as MenuProduct[];
    const calabresa = products.find((product) => product.name === 'Calabresa');
    const soldOut = products.find((product) => product.name === 'Esgotado');
    expect(calabresa).toEqual(
      expect.objectContaining({ priceCents: 4990, available: true }),
    );
    expect(soldOut).toEqual(expect.objectContaining({ available: false }));
    if (calabresa === undefined) {
      throw new Error('Calabresa was not seeded');
    }

    const grande = optionId(calabresa, 'Tamanho', 'Grande');
    const borda = optionId(calabresa, 'Adicionais', 'Borda');
    const sized = {
      items: [
        {
          productId: calabresa.id,
          quantity: 1,
          optionIds: [grande, borda],
        },
      ],
    };

    const accepted = await request(app.getHttpServer())
      .post('/api/v1/public/cart/validate')
      .set('X-Tenant-Host', 'pizzariadoze.localhost')
      .send(sized)
      .expect(200);
    expect(accepted.body.valid).toBe(true);
    expect(accepted.body.subtotalCents).toBe(4990 + 1000 + 800);
    expect(accepted.body.errors).toEqual([]);

    const foreign = await request(app.getHttpServer())
      .post('/api/v1/public/cart/validate')
      .set('X-Tenant-Host', 'burgercentral.localhost')
      .send(sized)
      .expect(200);
    expect(foreign.body.valid).toBe(false);
    expect(foreign.body.subtotalCents).toBe(0);
    expect(foreign.body.items).toEqual([]);
    expect(foreign.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PRODUCT_NOT_FOUND', itemIndex: 0 }),
      ]),
    );
    expect(JSON.stringify(foreign.body)).not.toContain('Calabresa');
    expect(JSON.stringify(foreign.body)).not.toContain('4990');

    const missingSize = await request(app.getHttpServer())
      .post('/api/v1/public/cart/validate')
      .set('X-Tenant-Host', 'pizzariadoze.localhost')
      .send({
        items: [
          {
            productId: calabresa.id,
            quantity: 1,
            optionIds: [borda],
          },
        ],
      })
      .expect(200);
    expect(missingSize.body.valid).toBe(false);

    await saveStore({ minimumOrderCents: 0, isManuallyClosed: true });
    const closed = await request(app.getHttpServer())
      .post('/api/v1/public/cart/validate')
      .set('X-Tenant-Host', 'pizzariadoze.localhost')
      .send(sized)
      .expect(200);
    expect(closed.body.storeOpen).toBe(false);
    expect(closed.body.valid).toBe(false);
    expect(closed.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'STORE_CLOSED', itemIndex: null }),
      ]),
    );

    await saveStore({ minimumOrderCents: 8000, isManuallyClosed: false });
    const belowMinimum = await request(app.getHttpServer())
      .post('/api/v1/public/cart/validate')
      .set('X-Tenant-Host', 'pizzariadoze.localhost')
      .send(sized)
      .expect(200);
    expect(belowMinimum.body.subtotalCents).toBe(6790);
    expect(belowMinimum.body.valid).toBe(false);
    expect(belowMinimum.body.errors).toEqual([
      expect.objectContaining({
        code: 'MINIMUM_ORDER_NOT_MET',
        itemIndex: null,
      }),
    ]);
  });

  async function saveStore(patch: {
    minimumOrderCents: number;
    isManuallyClosed: boolean;
  }): Promise<void> {
    if (storeSnapshot === null) {
      throw new Error('Store snapshot is missing');
    }
    await request(app.getHttpServer())
      .put('/api/v1/admin/store')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...storeSnapshot, ...patch })
      .expect(200);
  }
});

function optionId(product: MenuProduct, groupName: string, optionName: string): string {
  const group = product.optionGroups.find((candidate) => candidate.name === groupName);
  const option = group?.options.find((candidate) => candidate.name === optionName);
  if (option === undefined) {
    throw new Error(`${groupName} / ${optionName} was not seeded`);
  }
  return option.id;
}
