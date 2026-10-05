import { createHmac, randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { loadEnvFile } from '@ciadelivery/shared';
import Redis from 'ioredis';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createApiApplication } from './bootstrap';

const envSnapshot = { ...process.env };
const adminEmail = 'platform-admin@ciadelivery.test';
const adminPassword = 'PlatformAdmin1';
const appSecret = 'test-meta-app-secret';
const verifyToken = 'test-verify-token';
const accessToken = 'super-secret-token-value';

function slug(prefix: string): string {
  return `${prefix}-${randomBytes(4).toString('hex')}`;
}

function sign(raw: string): string {
  return `sha256=${createHmac('sha256', appSecret).update(raw).digest('hex')}`;
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

describe('whatsapp connection and webhook', () => {
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
    process.env['WHATSAPP_DRIVER'] = 'log';
    process.env['CREDENTIALS_ENCRYPTION_KEY'] =
      'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';
    process.env['META_APP_SECRET'] = appSecret;
    process.env['META_WEBHOOK_VERIFY_TOKEN'] = verifyToken;
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
          `DELETE FROM whatsapp_messages WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM conversations WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM message_templates WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM whatsapp_webhook_events WHERE tenant_id IN (${marks})`,
          createdTenantIds,
        );
        await dataSource.query(
          `DELETE FROM whatsapp_connections WHERE tenant_id IN (${marks})`,
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
          `DELETE FROM payment_methods WHERE tenant_id IN (${marks})`,
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

  it('connects with the log driver, hides the token and drops the secret on disconnect', async () => {
    const owner = await createOwner('zap-a', 'Zap A');
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => {
      throw new Error('network');
    };

    try {
      const connected = await request(app.getHttpServer())
        .post('/api/v1/admin/whatsapp/connect')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          phoneNumber: '+5511988887777',
          businessAccountId: '102290129340398',
          phoneNumberId: '106540352242922',
          accessToken,
        })
        .expect(200);

      expect(connected.body).toEqual(
        expect.objectContaining({
          status: 'CONNECTED',
          phoneNumber: '+5511988887777',
          phoneNumberId: '106540352242922',
          credentialsHint: 'alue',
        }),
      );
      expect(JSON.stringify(connected.body)).not.toContain(accessToken);

      const listed = await request(app.getHttpServer())
        .get('/api/v1/admin/whatsapp/connection')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      expect(JSON.stringify(listed.body)).not.toContain(accessToken);
      expect(listed.body.credentialsHint).toBe('alue');

      const dataSource = app.get(DataSource);
      const rows = await dataSource.query(
        'SELECT encrypted_credentials FROM whatsapp_connections WHERE tenant_id = ?',
        [owner.tenantId],
      );
      expect(String(rows[0].encrypted_credentials)).not.toContain(accessToken);

      await request(app.getHttpServer())
        .delete('/api/v1/admin/whatsapp/connection')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(204);

      const disconnected = await request(app.getHttpServer())
        .get('/api/v1/admin/whatsapp/connection')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      expect(disconnected.body.status).toBe('DISCONNECTED');
      expect(disconnected.body.credentialsHint).toBeNull();
      const secrets = await dataSource.query(
        'SELECT encrypted_credentials FROM whatsapp_connections WHERE tenant_id = ?',
        [owner.tenantId],
      );
      expect(secrets[0].encrypted_credentials).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('stores one event for a repeated wamid and keeps it on the phone owner', async () => {
    const ownerA = await createOwner('zap-iso-a', 'Zap Iso A');
    const ownerB = await createOwner('zap-iso-b', 'Zap Iso B');
    await connect(ownerA.token, '111000111', accessToken);
    await connect(ownerB.token, '222000222', 'other-store-token-9999');

    const raw = JSON.stringify(webhook('111000111', 'wamid.ONCE'));
    await postWebhook(raw, sign(raw)).expect(200);
    await postWebhook(raw, sign(raw)).expect(200);
    await postWebhook(raw, 'sha256=deadbeef').expect(401);

    const dataSource = app.get(DataSource);
    const rows = await dataSource.query(
      'SELECT tenant_id, external_id FROM whatsapp_webhook_events WHERE external_id = ?',
      ['wamid.ONCE'],
    );
    expect(rows).toEqual([{ tenant_id: ownerA.tenantId, external_id: 'wamid.ONCE' }]);

    const foreign = await dataSource.query(
      'SELECT id FROM whatsapp_webhook_events WHERE tenant_id = ?',
      [ownerB.tenantId],
    );
    expect(foreign).toEqual([]);

    const rejected = await dataSource.query(
      'SELECT id FROM whatsapp_webhook_events WHERE external_id = ?',
      ['wamid.ONCE'],
    );
    expect(rejected).toHaveLength(1);
  });

  it('answers the hub challenge in plain text and ignores an unknown number', async () => {
    const challenge = await request(app.getHttpServer())
      .get('/api/v1/webhooks/whatsapp')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': verifyToken,
        'hub.challenge': '123456',
      })
      .expect(200);
    expect(challenge.text).toBe('123456');
    expect(challenge.headers['content-type']).toContain('text/plain');

    const forbidden = await request(app.getHttpServer())
      .get('/api/v1/webhooks/whatsapp')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'nope',
        'hub.challenge': '123456',
      })
      .expect(403);
    expect(forbidden.body.error.code).toBe('WHATSAPP_WEBHOOK_FORBIDDEN');

    const raw = JSON.stringify(webhook('999000999', 'wamid.UNKNOWN'));
    await postWebhook(raw, sign(raw)).expect(200);
    const dataSource = app.get(DataSource);
    const rows = await dataSource.query(
      'SELECT id FROM whatsapp_webhook_events WHERE external_id = ?',
      ['wamid.UNKNOWN'],
    );
    expect(rows).toEqual([]);
  });

  function postWebhook(raw: string, signature: string) {
    return request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signature)
      .send(raw);
  }

  async function connect(
    token: string,
    phoneNumberId: string,
    tokenValue: string,
  ): Promise<void> {
    await request(app.getHttpServer())
      .post('/api/v1/admin/whatsapp/connect')
      .set('Authorization', `Bearer ${token}`)
      .send({
        phoneNumber: '+5511977776666',
        businessAccountId: '102290129340398',
        phoneNumberId,
        accessToken: tokenValue,
      })
      .expect(200);
  }

  async function createOwner(
    prefix: string,
    name: string,
  ): Promise<{ token: string; tenantId: string }> {
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
        address: {
          line: 'Rua das Flores',
          number: '100',
          district: 'Centro',
          city: 'Sao Paulo',
          state: 'SP',
          postalCode: '01000-000',
        },
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
      tenantId: tenant.body.id as string,
    };
  }
});

function webhook(phoneNumberId: string, messageId: string): unknown {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: phoneNumberId },
              messages: [{ id: messageId, from: '5511999999999', type: 'text' }],
            },
          },
        ],
      },
    ],
  };
}
