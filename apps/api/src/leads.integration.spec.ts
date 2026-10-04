import { INestApplication } from '@nestjs/common';
import { loadEnvFile } from '@ciadelivery/shared';
import Redis from 'ioredis';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createApiApplication } from './bootstrap';

const envSnapshot = { ...process.env };

async function clearLeadLimits(): Promise<void> {
  const redis = new Redis({
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: Number(process.env['REDIS_PORT'] ?? '6379'),
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  const keys = await redis.keys('leads:ip:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  redis.disconnect();
}

describe('public leads', () => {
  let app!: INestApplication;

  beforeAll(async () => {
    loadEnvFile();
    process.env['NODE_ENV'] = 'local';
    process.env['JWT_ACCESS_SECRET'] =
      process.env['JWT_ACCESS_SECRET'] ?? 'local-development-jwt-access-secret';
    process.env['SEED_DEMO'] = 'false';
    process.env['SEED_PLATFORM_ADMIN'] = 'false';
    app = await createApiApplication();
    await app.init();
  });

  beforeEach(async () => {
    await clearLeadLimits();
  });

  afterAll(async () => {
    if (app !== undefined) {
      const dataSource = app.get(DataSource);
      if (dataSource.isInitialized) {
        await dataSource.query('DELETE FROM `leads`');
      }
      await app.close();
      await clearLeadLimits();
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

  it('stores a lead and does not expose a public list', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/public/leads')
      .send({
        name: 'Ana Souza',
        email: 'Ana@Padaria.example',
        phone: '11999999999',
        establishmentName: 'Padaria da Ana',
      })
      .expect(201);
    expect(created.body.id).toEqual(expect.any(String));
    expect(created.body.email).toBeUndefined();
    expect(created.body.tenantId).toBeUndefined();

    const listed = await request(app.getHttpServer())
      .get('/api/v1/public/leads')
      .expect(404);
    expect(listed.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('rejects an empty lead', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/public/leads')
      .send({})
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('limits five leads per hour for the same IP', async () => {
    const body = {
      name: 'Ana Souza',
      email: 'ana@padaria.example',
      phone: '11999999999',
      establishmentName: 'Padaria da Ana',
    };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/public/leads')
        .send(body)
        .expect(201);
    }

    const limited = await request(app.getHttpServer())
      .post('/api/v1/public/leads')
      .send(body)
      .expect(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
  });
});
