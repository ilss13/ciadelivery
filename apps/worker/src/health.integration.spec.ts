import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { loadEnvFile } from '@ciadelivery/shared';
import { DataSource } from 'typeorm';
import { createWorkerApplication } from './bootstrap';

describe('worker health', () => {
  const envSnapshot = { ...process.env };
  let app: INestApplication;

  beforeAll(async () => {
    loadEnvFile();
    process.env['NODE_ENV'] = 'local';
    app = await createWorkerApplication();
    await app.init();
  });

  afterAll(async () => {
    const dataSource = app.get(DataSource);
    await app.close();
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    for (const key of Object.keys(process.env)) {
      if (!(key in envSnapshot)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, envSnapshot);
  });

  it('exposes liveness and readiness', async () => {
    const liveness = await request(app.getHttpServer())
      .get('/health/liveness')
      .expect(200);
    expect(liveness.body).toEqual({ status: 'ok' });

    const readiness = await request(app.getHttpServer())
      .get('/health/readiness')
      .set('X-Request-Id', 'worker-ready')
      .expect(200);
    expect(readiness.body).toEqual({ status: 'ok' });
    expect(readiness.headers['x-request-id']).toBe('worker-ready');
  });
});
