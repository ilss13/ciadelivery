import { createHash, randomBytes } from 'node:crypto';
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

function refreshCookie(setCookie: string | string[] | undefined): string {
  const lines = Array.isArray(setCookie) ? setCookie : [setCookie ?? ''];
  const line = lines.find((value) => value.startsWith('refresh_token='));
  if (line === undefined) {
    throw new Error('missing refresh cookie');
  }
  return line.split(';')[0]?.slice('refresh_token='.length) ?? '';
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

describe('authentication and tenant users', () => {
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
    process.env['LOG_PASSWORD_RESET'] = 'false';
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
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    }
    await clearLoginRateLimits();

    for (const key of Object.keys(process.env)) {
      if (!(key in envSnapshot)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, envSnapshot);
  });

  it('logs in, refreshes, reuses a rotated token and logs out', async () => {
    const password = 'OwnerPassword1';
    const owner = await createOwner('padaria-a', 'Ana', password);
    const captured: string[] = [];
    const stdout = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk) => {
        captured.push(String(chunk));
        return true;
      });

    let login: request.Response;
    try {
      login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: owner.email, password })
        .expect(200);
    } finally {
      stdout.mockRestore();
    }

    expect(login.body.password).toBeUndefined();
    expect(login.body.passwordHash).toBeUndefined();
    expect(JSON.stringify(login.body).includes(password)).toBe(false);
    expect(captured.some((line) => line.includes(password))).toBe(false);
    const cookieHeader = login.headers['set-cookie'];
    const cookieText = String(cookieHeader);
    expect(cookieText).toMatch(/HttpOnly/i);
    expect(cookieText).toMatch(/SameSite=Lax/i);
    expect(cookieText).toMatch(/Path=\/api\/v1\/auth/i);
    expect(cookieText).not.toMatch(/Secure/i);
    const current = refreshCookie(cookieHeader);

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken as string}`)
      .expect(200);
    expect(me.body.email).toBe(owner.email);
    expect(me.body.role).toBe('OWNER');
    expect(JSON.stringify(me.body).includes(password)).toBe(false);

    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${current}`)
      .expect(200);
    const rotated = refreshCookie(refreshed.headers['set-cookie']);
    expect(rotated).not.toBe(current);

    const reused = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${current}`)
      .expect(401);
    expect(reused.body.error.code).toBe('REFRESH_REUSED');

    const family = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${rotated}`)
      .expect(401);
    expect(family.body.error.code).toBe('INVALID_REFRESH');

    const nextLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: owner.email, password })
      .expect(200);
    const sessionCookie = refreshCookie(nextLogin.headers['set-cookie']);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', `refresh_token=${sessionCookie}`)
      .expect(204);
    const afterLogout = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${sessionCookie}`)
      .expect(401);
    expect(afterLogout.body.error.code).toBe('INVALID_REFRESH');
  });

  it('locks the email on the fifth failure and hides unknown emails', async () => {
    const email = `missing-${randomBytes(3).toString('hex')}@example.com`;
    emails.push(email);
    const unknown = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'Whatever123' })
      .expect(401);
    expect(unknown.body.error.code).toBe('INVALID_CREDENTIALS');

    const lockedEmail = `locked-${randomBytes(3).toString('hex')}@example.com`;
    emails.push(lockedEmail);
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const failed = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: lockedEmail, password: 'WrongPassword1' })
        .expect(401);
      expect(failed.body.error.code).toBe('INVALID_CREDENTIALS');
    }
    const fifth = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: lockedEmail, password: 'WrongPassword1' })
      .expect(429);
    expect(fifth.body.error.code).toBe('LOGIN_LOCKED');
    const sixth = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: lockedEmail, password: 'WrongPassword1' })
      .expect(429);
    expect(sixth.body.error.code).toBe('LOGIN_LOCKED');
  });

  it('answers forgot-password the same way for known and unknown emails', async () => {
    const owner = await createOwner('padaria-b', 'Bia', 'OwnerPassword1');
    const known = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: owner.email })
      .expect(202);
    const unknown = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: `nobody-${randomBytes(3).toString('hex')}@example.com` })
      .expect(202);
    expect(known.text).toBe(unknown.text);
    expect(known.text.includes(owner.email)).toBe(false);
  });

  it('isolates users by tenant and blocks an attendant without users.manage', async () => {
    const password = 'OwnerPassword1';
    const ownerA = await createOwner('loja-a', 'Olga', password);
    const ownerB = await createOwner('loja-b', 'Otto', password);
    const loginA = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerA.email, password })
      .expect(200);
    const tokenA = loginA.body.accessToken as string;

    const attendantEmail = `attendant-${randomBytes(3).toString('hex')}@example.com`;
    emails.push(attendantEmail);
    const attendant = await request(app.getHttpServer())
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Caixa',
        email: attendantEmail,
        password: 'Attendant123',
        role: 'ATTENDANT',
        tenantId: ownerB.tenantId,
      })
      .expect(400);
    expect(attendant.body.error.code).toBe('VALIDATION_ERROR');

    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Caixa',
        email: attendantEmail,
        password: 'Attendant123',
        role: 'ATTENDANT',
      })
      .expect(201);
    expect(created.body.tenantId).toBe(ownerA.tenantId);
    expect(JSON.stringify(created.body).includes('Attendant123')).toBe(false);

    const listA = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const emailsInA = (listA.body.data as { email: string }[]).map(
      (user) => user.email,
    );
    expect(emailsInA).toContain(ownerA.email);
    expect(emailsInA).not.toContain(ownerB.email);

    const hidden = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${ownerB.userId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
    expect(hidden.body.error.code).toBe('USER_NOT_FOUND');

    const attendantLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: attendantEmail, password: 'Attendant123' })
      .expect(200);
    const denied = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${attendantLogin.body.accessToken as string}`)
      .expect(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${created.body.id as string}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'DISABLED' })
      .expect(200);
    const disabled = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${attendantLogin.body.accessToken as string}`)
      .expect(403);
    expect(disabled.body.error.code).toBe('USER_DISABLED');
  });

  it('rate limits login by IP', async () => {
    await clearLoginRateLimits();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const email = `rate-${attempt}-${randomBytes(2).toString('hex')}@example.com`;
      emails.push(email);
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'WrongPassword1' })
        .expect(401);
    }
    const limited = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'rate-final@example.com',
        password: 'WrongPassword1',
      })
      .expect(429);
    emails.push('rate-final@example.com');
    expect(limited.body.error.code).toBe('RATE_LIMITED');
  });

  it('resets a password with a single-use token and revokes refresh tokens', async () => {
    const password = 'OwnerPassword1';
    const owner = await createOwner('loja-reset', 'Rita', password);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: owner.email, password })
      .expect(200);
    const cookie = refreshCookie(login.headers['set-cookie']);
    const raw = `reset-${randomBytes(16).toString('hex')}`;
    const dataSource = app.get(DataSource);
    await dataSource.query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
       VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 30 MINUTE), NULL, UTC_TIMESTAMP(3))`,
      [
        randomBytes(16).toString('hex').padEnd(36, '0').slice(0, 36),
        owner.userId,
        createHash('sha256').update(raw).digest('hex'),
      ],
    );

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: raw, password: 'short' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: raw, password: 'NovaSenha123' })
      .expect(204);

    const revoked = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${cookie}`)
      .expect(401);
    expect(revoked.body.error.code).toBe('INVALID_REFRESH');

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: owner.email, password: 'NovaSenha123' })
      .expect(200);
  });

  async function createOwner(
    prefix: string,
    name: string,
    password: string,
  ): Promise<{ email: string; tenantId: string; userId: string }> {
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
    const owner = await request(app.getHttpServer())
      .post(`/api/v1/platform/tenants/${tenant.body.id as string}/owner`)
      .set('Authorization', `Bearer ${admin.body.accessToken as string}`)
      .send({ name, email, password })
      .expect(201);
    return {
      email,
      tenantId: tenant.body.id as string,
      userId: owner.body.id as string,
    };
  }
});
