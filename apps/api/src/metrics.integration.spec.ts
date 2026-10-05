import { INestApplication } from '@nestjs/common';
import { loadEnvFile } from '@ciadelivery/shared';
import request from 'supertest';
import { createApiApplication } from './bootstrap';

describe('metrics token', () => {
  jest.setTimeout(60_000);

  const previous = process.env['METRICS_TOKEN'];
  let app!: INestApplication;

  beforeAll(async () => {
    loadEnvFile();
    process.env['NODE_ENV'] = 'local';
    process.env['JWT_ACCESS_SECRET'] =
      process.env['JWT_ACCESS_SECRET'] ??
      'local-development-jwt-access-secret';
    process.env['SEED_PLATFORM_ADMIN'] = 'false';
    process.env['SEED_DEMO'] = 'false';
    process.env['LOG_PASSWORD_RESET'] = 'false';
    process.env['METRICS_TOKEN'] = 'metrics-secret';
    app = await createApiApplication();
    await app.init();
  });

  afterAll(async () => {
    if (previous === undefined) {
      delete process.env['METRICS_TOKEN'];
    } else {
      process.env['METRICS_TOKEN'] = previous;
    }
    if (app !== undefined) {
      await app.close();
    }
  });

  it('rejects a scrape without the metrics token and ignores it as a jwt', async () => {
    const denied = await request(app.getHttpServer()).get('/metrics').expect(401);
    expect(denied.text).toBe('unauthorized\n');
    expect(denied.body).toEqual({});

    const scraped = await request(app.getHttpServer())
      .get('/metrics')
      .set('Authorization', 'Bearer metrics-secret')
      .expect(200);
    expect(scraped.headers['content-type']).toContain('text/plain');
    expect(scraped.text).toContain('orders_created_total');
    expect(scraped.text).toContain('outbox_events{state="failed"}');
    expect(scraped.text).toContain('whatsapp_messages_failed_total');
    expect(scraped.text).not.toContain('tenant_id');
  });
});
