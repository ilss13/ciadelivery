import { DomainException } from '@ciadelivery/shared';
import { ResolveTenant } from './application/resolve-tenant';
import { parseTenantHost } from './domain/parse-tenant-host';
import { selectRequestHost } from './domain/request-host';
import { Tenant } from './domain/tenant';
import { TenantRepository } from './domain/tenant-repository';

const platformDomain = 'localhost';

function tenant(overrides: Partial<Tenant> = {}): Tenant {
  const now = new Date('2026-10-03T12:00:00.000Z');
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Padaria',
    slug: 'padaria',
    status: 'ACTIVE',
    planCode: 'STANDARD',
    customDomain: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function repository(rows: Tenant[]): TenantRepository {
  return {
    insert: async () => undefined,
    update: async () => undefined,
    findById: async () => null,
    findBySlug: async (slug) => rows.find((row) => row.slug === slug) ?? null,
    findByCustomDomain: async (domain) =>
      rows.find((row) => row.customDomain === domain) ?? null,
    list: async () => ({ items: [], total: 0 }),
  };
}

describe('parseTenantHost', () => {
  it('strips the port and classifies platform, slug, reserved and custom hosts', () => {
    expect(parseTenantHost('localhost:4200', platformDomain)).toEqual({
      kind: 'platform',
    });
    expect(parseTenantHost('www.localhost', platformDomain)).toEqual({
      kind: 'platform',
    });
    expect(parseTenantHost('painel.localhost', platformDomain)).toEqual({
      kind: 'platform',
    });
    expect(parseTenantHost('Padaria.localhost:4201', platformDomain)).toEqual({
      kind: 'slug',
      slug: 'padaria',
    });
    expect(parseTenantHost('api.localhost', platformDomain)).toEqual({
      kind: 'reserved',
      slug: 'api',
    });
    expect(parseTenantHost('pedidos.padaria.com:443', platformDomain)).toEqual({
      kind: 'custom-domain',
      host: 'pedidos.padaria.com',
    });
  });
});

describe('selectRequestHost', () => {
  it('uses X-Tenant-Host only for local and development', () => {
    expect(
      selectRequestHost({
        nodeEnv: 'local',
        hostHeader: 'localhost:3000',
        tenantHostHeader: 'padaria.localhost',
      }),
    ).toBe('padaria.localhost');
    expect(
      selectRequestHost({
        nodeEnv: 'production',
        hostHeader: 'padaria.example.com',
        tenantHostHeader: 'outra.example.com',
      }),
    ).toBe('padaria.example.com');
    expect(
      selectRequestHost({
        nodeEnv: 'staging',
        hostHeader: 'padaria.example.com',
        tenantHostHeader: 'outra.example.com',
      }),
    ).toBe('padaria.example.com');
  });
});

describe('ResolveTenant', () => {
  const active = tenant();
  const suspended = tenant({
    id: '22222222-2222-4222-8222-222222222222',
    slug: 'fechada',
    status: 'SUSPENDED',
    customDomain: 'fechada.example',
  });
  const trial = tenant({
    id: '33333333-3333-4333-8333-333333333333',
    slug: 'trial',
    status: 'TRIAL',
    customDomain: 'pedidos.trial.com',
  });
  const resolver = new ResolveTenant(repository([active, suspended, trial]));

  it('returns the tenant for an active slug and a trial custom domain', async () => {
    await expect(
      resolver.execute('padaria.localhost', platformDomain),
    ).resolves.toEqual({ kind: 'tenant', tenant: active });
    await expect(
      resolver.execute('pedidos.trial.com', platformDomain),
    ).resolves.toEqual({ kind: 'tenant', tenant: trial });
  });

  it('rejects a suspended tenant from the slug and from the custom domain', async () => {
    await expect(
      resolver.execute('fechada.localhost', platformDomain),
    ).rejects.toMatchObject({
      code: 'TENANT_SUSPENDED',
      statusCode: 403,
    });
    await expect(
      resolver.execute('fechada.example', platformDomain),
    ).rejects.toBeInstanceOf(DomainException);
  });

  it('rejects an unknown host and a reserved slug', async () => {
    await expect(
      resolver.execute('missing.localhost', platformDomain),
    ).rejects.toMatchObject({ code: 'TENANT_NOT_FOUND', statusCode: 404 });
    await expect(
      resolver.execute('admin.localhost', platformDomain),
    ).rejects.toMatchObject({ code: 'TENANT_NOT_FOUND', statusCode: 404 });
  });

  it('does not resolve a tenant for the platform host', async () => {
    await expect(
      resolver.execute('localhost:4200', platformDomain),
    ).resolves.toEqual({ kind: 'platform' });
  });
});
