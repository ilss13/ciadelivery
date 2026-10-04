import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  APP_CONFIG,
  HttpExceptionFilter,
  PlatformModule,
  loadAppConfig,
  loadEnvFile,
} from '@ciadelivery/shared';
import { DataSource } from 'typeorm';
import { createApiApplication } from './bootstrap';

const envSnapshot = { ...process.env };

async function closeApp(app: INestApplication): Promise<void> {
  const dataSource = app.get(DataSource);
  await app.close();
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
}

describe('api http platform', () => {
  let app: INestApplication;

  beforeAll(async () => {
    loadEnvFile();
    process.env['NODE_ENV'] = 'local';
    app = await createApiApplication();
    await app.init();
  });

  afterAll(async () => {
    await closeApp(app);
    for (const key of Object.keys(process.env)) {
      if (!(key in envSnapshot)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, envSnapshot);
  });

  it('reports liveness without checking dependencies', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    expect(response.body).toEqual({ status: 'ok' });

    const liveness = await request(app.getHttpServer())
      .get('/health/liveness')
      .expect(200);
    expect(liveness.body).toEqual({ status: 'ok' });
  });

  it('is ready when MySQL and Redis answer', async () => {
    const response = await request(app.getHttpServer())
      .get('/health/readiness')
      .set('X-Request-Id', 'ready-req')
      .expect(200);

    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toBe('ready-req');
  });

  it('allows the local storefront origin and refuses an unknown origin', async () => {
    const allowed = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'http://localhost:4201')
      .expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:4201',
    );

    const denied = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'http://evil.example')
      .expect(200);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('sends helmet headers', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('returns ROUTE_NOT_FOUND for an unknown route', async () => {
    const response = await request(app.getHttpServer())
      .get('/missing-route')
      .set('X-Request-Id', 'missing-req')
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'The requested route does not exist',
        details: null,
        requestId: 'missing-req',
      },
    });
  });

  it('publishes swagger outside production', async () => {
    const document = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);

    expect(document.body.paths['/health']).toBeDefined();
    expect(document.body.paths['/health/liveness']).toBeDefined();
    expect(document.body.paths['/health/readiness']).toBeDefined();

    await request(app.getHttpServer()).get('/api/docs').expect(200);
  });

  it('returns 503 when Redis cannot be reached', async () => {
    loadEnvFile();
    process.env['NODE_ENV'] = 'local';
    const config = loadAppConfig();
    const moduleRef = await Test.createTestingModule({
      imports: [PlatformModule],
    })
      .overrideProvider(APP_CONFIG)
      .useValue({ ...config, redisHost: '127.0.0.1', redisPort: 1 })
      .compile();
    const broken = moduleRef.createNestApplication();
    broken.useGlobalFilters(new HttpExceptionFilter());
    await broken.init();

    try {
      const response = await request(broken.getHttpServer())
        .get('/health/readiness')
        .expect(503);
      expect(response.body).toEqual({ status: 'unavailable' });
    } finally {
      await closeApp(broken);
    }
  });
});

describe('swagger in production', () => {
  let app: INestApplication;

  beforeAll(async () => {
    loadEnvFile();
    process.env['NODE_ENV'] = 'production';
    app = await createApiApplication();
    await app.init();
  });

  afterAll(async () => {
    await closeApp(app);
    for (const key of Object.keys(process.env)) {
      if (!(key in envSnapshot)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, envSnapshot);
  });

  it('does not mount the docs route', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs')
      .expect(404);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
