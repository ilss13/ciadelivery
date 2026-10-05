import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { loadEnvFile } from '@ciadelivery/shared';
import {
  STORES,
  UNIT_OF_WORK,
  type Stores,
  type UnitOfWork,
} from '@ciadelivery/tenancy';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createApiApplication } from './bootstrap';

const envSnapshot = { ...process.env };

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

describe('tenant and store context', () => {
  let app!: INestApplication;
  let token = '';
  const adminEmail = 'platform-admin@ciadelivery.test';
  const adminPassword = 'PlatformAdmin1';
  const createdIds: string[] = [];
  const slugA = slug('padaria-a');
  const slugB = slug('padaria-b');
  let idA = '';
  let idB = '';

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
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(200);
    token = login.body.accessToken as string;

    idA = await createTenant('Padaria A', slugA);
    idB = await createTenant('Padaria B', slugB);
  });

  afterAll(async () => {
    if (app !== undefined) {
      const dataSource = app.get(DataSource);
      if (dataSource.isInitialized && createdIds.length > 0) {
        const marks = createdIds.map(() => '?').join(', ');
        await dataSource.query(
          `DELETE FROM payment_methods WHERE tenant_id IN (${marks})`,
          createdIds,
        );
        await dataSource.query(
          `DELETE FROM stores WHERE tenant_id IN (${marks})`,
          createdIds,
        );
        await dataSource.query(
          `DELETE FROM tenants WHERE id IN (${marks})`,
          createdIds,
        );
      }
      await app.close();
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

  it('returns only the store of the host and ignores a tenant id in the query', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/public/store')
      .query({ tenantId: idB })
      .set('Host', `${slugA}.localhost`)
      .expect(200);

    expect(response.body).toMatchObject({
      name: 'Padaria A',
      slug: slugA,
      phone: '11999999999',
      minimumOrderCents: 0,
      isManuallyClosed: false,
      address: address(),
    });
    expect(response.body.tenantId).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('Padaria B');
    expect(JSON.stringify(response.body)).not.toContain(slugB);
    expect(JSON.stringify(response.body)).not.toContain(token);
  });

  it('resolves the other tenant from X-Tenant-Host in local', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/public/store')
      .set('X-Tenant-Host', `${slugB}.localhost`)
      .expect(200);

    expect(response.body.name).toBe('Padaria B');
    expect(response.body.slug).toBe(slugB);
    expect(JSON.stringify(response.body)).not.toContain('Padaria A');
  });

  it('resolves a custom domain and rejects an unknown host', async () => {
    const domain = `${slugB}.example`;
    await request(app.getHttpServer())
      .patch(`/api/v1/platform/tenants/${idB}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ customDomain: domain })
      .expect(200);

    const found = await request(app.getHttpServer())
      .get('/api/v1/public/store')
      .set('Host', domain)
      .expect(200);
    expect(found.body.slug).toBe(slugB);

    const missing = await request(app.getHttpServer())
      .get('/api/v1/public/store')
      .set('Host', 'desconhecida.example')
      .expect(404);
    expect(missing.body.error.code).toBe('TENANT_NOT_FOUND');
  });

  it('has no public route that accepts a tenant id in the body', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/public/store')
      .set('Host', `${slugA}.localhost`)
      .send({ tenantId: idB, name: 'hacked' })
      .expect(404);

    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('refuses a second store for the same tenant', async () => {
    const stores = app.get<Stores>(STORES);
    const unitOfWork = app.get<UnitOfWork>(UNIT_OF_WORK);

    await expect(
      unitOfWork.run((tx) =>
        stores.createInitialStore(
          {
            tenantId: idA,
            name: 'Segunda loja',
            phone: '11988887777',
            address: address(),
          },
          tx,
        ),
      ),
    ).rejects.toMatchObject({
      code: 'STORE_LIMIT_REACHED',
      statusCode: 409,
    });
  });

  it('rejects the public store of a suspended tenant', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/platform/tenants/${idA}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'SUSPENDED', tenantId: idB })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/platform/tenants/${idA}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'SUSPENDED' })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/api/v1/public/store')
      .set('Host', `${slugA}.localhost`)
      .expect(403);
    expect(response.body.error.code).toBe('TENANT_SUSPENDED');
  });

  it('refuses platform routes without a super admin token and a reserved slug', async () => {
    const missing = await request(app.getHttpServer())
      .get('/api/v1/platform/tenants')
      .expect(401);
    expect(missing.body.error.code).toBe('PLATFORM_UNAUTHORIZED');

    const bootstrap = await request(app.getHttpServer())
      .get('/api/v1/platform/tenants')
      .set('X-Platform-Token', 'local-bootstrap-token')
      .expect(401);
    expect(bootstrap.body.error.code).toBe('PLATFORM_UNAUTHORIZED');

    const reserved = await request(app.getHttpServer())
      .post('/api/v1/platform/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Reservado',
        slug: 'api',
        phone: '11999999999',
        address: address(),
      })
      .expect(409);
    expect(reserved.body.error.code).toBe('TENANT_SLUG_RESERVED');
  });

  async function createTenant(
    name: string,
    tenantSlug: string,
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/platform/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name,
        slug: tenantSlug,
        phone: '11999999999',
        address: address(),
      })
      .expect(201);

    expect(response.body.store.name).toBe(name);
    expect(response.body.planCode).toBe('STANDARD');
    expect(response.body.status).toBe('ACTIVE');
    createdIds.push(response.body.id as string);
    return response.body.id as string;
  }
});
