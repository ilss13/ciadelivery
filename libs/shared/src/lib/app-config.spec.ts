import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { isOriginAllowed, loadAppConfig, loadEnvFile } from './app-config';

const validEnv = {
  NODE_ENV: 'local',
  API_PORT: '3000',
  WORKER_PORT: '3001',
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '3306',
  DATABASE_USER: 'ciadelivery',
  DATABASE_PASSWORD: 'ciadelivery',
  DATABASE_NAME: 'ciadelivery',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  PLATFORM_DOMAIN: 'localhost',
  JWT_ACCESS_SECRET: 'local-development-jwt-access-secret',
  CORS_ORIGINS:
    'http://localhost:4200, http://localhost:4201,http://localhost:4202,http://localhost:4203',
  CREDENTIALS_ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
};

describe('loadAppConfig', () => {
  it('returns a typed config when every required variable is present', () => {
    expect(loadAppConfig(validEnv)).toEqual({
      nodeEnv: 'local',
      apiPort: 3000,
      workerPort: 3001,
      databaseHost: 'localhost',
      databasePort: 3306,
      databaseUser: 'ciadelivery',
      databasePassword: 'ciadelivery',
      databaseName: 'ciadelivery',
      databasePoolSize: 10,
      redisHost: 'localhost',
      redisPort: 6379,
      platformDomain: 'localhost',
      jwtAccessSecret: 'local-development-jwt-access-secret',
      seedPlatformAdmin: false,
      platformAdminEmail: '',
      platformAdminPassword: '',
      logPasswordReset: false,
      corsOrigins: [
        'http://localhost:4200',
        'http://localhost:4201',
        'http://localhost:4202',
        'http://localhost:4203',
      ],
      storeTimezone: 'America/Sao_Paulo',
      seedDemo: false,
      demoOwnerPassword: '',
      storageDriver: 'local',
      storageLocalDir: resolve('storage'),
      storagePublicBaseUrl: 'http://localhost:3000',
      s3Endpoint: '',
      s3Bucket: '',
      s3AccessKey: '',
      s3SecretKey: '',
      s3Region: '',
      geocodingDriver: 'stub',
      geocodingUrl: '',
      credentialsEncryptionKey: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
      whatsappDriver: 'log',
      metaGraphVersion: 'v21.0',
      metaAppSecret: '',
      metaWebhookVerifyToken: '',
      whatsappAllowSessionMessages: false,
    });
  });

  it('keeps the local driver when S3 variables are absent', () => {
    expect(loadAppConfig(validEnv).storageDriver).toBe('local');
  });

  it('requires the S3 settings only when that driver is selected', () => {
    expect(() =>
      loadAppConfig({ ...validEnv, STORAGE_DRIVER: 's3' }),
    ).toThrow('S3_ENDPOINT');
    expect(
      loadAppConfig({
        ...validEnv,
        STORAGE_DRIVER: 's3',
        S3_ENDPOINT: 'http://minio:9000',
        S3_BUCKET: 'media',
        S3_ACCESS_KEY: 'access',
        S3_SECRET_KEY: 'secret',
        S3_REGION: 'us-east-1',
      }).storageDriver,
    ).toBe('s3');
  });

  it('requires the geocoding URL only when the http driver is selected', () => {
    expect(() =>
      loadAppConfig({ ...validEnv, GEOCODING_DRIVER: 'http' }),
    ).toThrow('GEOCODING_URL');
    expect(
      loadAppConfig({
        ...validEnv,
        GEOCODING_DRIVER: 'http',
        GEOCODING_URL: 'http://geocode.internal/lookup',
      }).geocodingDriver,
    ).toBe('http');
  });

  it('uses DATABASE_POOL_SIZE when it is set', () => {
    expect(
      loadAppConfig({ ...validEnv, DATABASE_POOL_SIZE: '25' }).databasePoolSize,
    ).toBe(25);
  });

  it('refuses an empty database password', () => {
    expect(() =>
      loadAppConfig({ ...validEnv, DATABASE_PASSWORD: '   ' }),
    ).toThrow('DATABASE_PASSWORD');
  });

  it('refuses a missing CORS origin list', () => {
    const env = { ...validEnv, CORS_ORIGINS: '' };
    expect(() => loadAppConfig(env)).toThrow('CORS_ORIGINS');
  });

  it('refuses an unknown environment name', () => {
    expect(() => loadAppConfig({ ...validEnv, NODE_ENV: 'test' })).toThrow(
      'Invalid NODE_ENV',
    );
  });

  it('refuses a port that is not an integer', () => {
    expect(() => loadAppConfig({ ...validEnv, API_PORT: 'abc' })).toThrow(
      'Invalid API_PORT',
    );
  });

  it('refuses a JWT secret shorter than 32 characters', () => {
    expect(() =>
      loadAppConfig({ ...validEnv, JWT_ACCESS_SECRET: 'too-short' }),
    ).toThrow('Invalid JWT_ACCESS_SECRET');
  });

  it('refuses to seed a platform admin in production', () => {
    expect(() =>
      loadAppConfig({
        ...validEnv,
        NODE_ENV: 'production',
        SEED_PLATFORM_ADMIN: 'true',
        PLATFORM_ADMIN_EMAIL: 'admin@example.com',
        PLATFORM_ADMIN_PASSWORD: 'PlatformAdmin1',
      }),
    ).toThrow('SEED_PLATFORM_ADMIN must not be enabled in production');
  });

  it('refuses a seed flag without the admin email', () => {
    expect(() =>
      loadAppConfig({
        ...validEnv,
        SEED_PLATFORM_ADMIN: 'true',
        PLATFORM_ADMIN_PASSWORD: 'PlatformAdmin1',
      }),
    ).toThrow('PLATFORM_ADMIN_EMAIL');
  });

  it('refuses to seed demo tenants in production', () => {
    expect(() =>
      loadAppConfig({
        ...validEnv,
        NODE_ENV: 'production',
        SEED_DEMO: 'true',
        DEMO_OWNER_PASSWORD: 'DemoOwner123',
      }),
    ).toThrow('SEED_DEMO must not be enabled in production');
  });

  it('refuses a demo seed without the owner password', () => {
    expect(() => loadAppConfig({ ...validEnv, SEED_DEMO: 'true' })).toThrow(
      'DEMO_OWNER_PASSWORD',
    );
  });

  it('refuses an unknown store timezone', () => {
    expect(() =>
      loadAppConfig({ ...validEnv, STORE_TIMEZONE: 'Not/AZone' }),
    ).toThrow('Invalid STORE_TIMEZONE');
  });

  it('requires the credentials key in local and checks its size', () => {
    const { CREDENTIALS_ENCRYPTION_KEY: _key, ...withoutKey } = validEnv;
    expect(() => loadAppConfig(withoutKey)).toThrow(
      'CREDENTIALS_ENCRYPTION_KEY',
    );
    expect(() =>
      loadAppConfig({
        ...validEnv,
        CREDENTIALS_ENCRYPTION_KEY: Buffer.from('short').toString('base64'),
      }),
    ).toThrow('Invalid CREDENTIALS_ENCRYPTION_KEY');
    expect(
      loadAppConfig({ ...withoutKey, NODE_ENV: 'staging' })
        .credentialsEncryptionKey,
    ).toBe('');
  });

  it('ignores session messages in production', () => {
    expect(
      loadAppConfig({
        ...validEnv,
        NODE_ENV: 'production',
        WHATSAPP_ALLOW_SESSION_MESSAGES: 'true',
      }).whatsappAllowSessionMessages,
    ).toBe(false);
    expect(
      loadAppConfig({
        ...validEnv,
        WHATSAPP_ALLOW_SESSION_MESSAGES: 'true',
      }).whatsappAllowSessionMessages,
    ).toBe(true);
  });

  it('accepts the Meta driver and refuses an unknown one', () => {
    expect(
      loadAppConfig({ ...validEnv, WHATSAPP_DRIVER: 'meta' }).whatsappDriver,
    ).toBe('meta');
    expect(() =>
      loadAppConfig({ ...validEnv, WHATSAPP_DRIVER: 'web' }),
    ).toThrow('Invalid WHATSAPP_DRIVER');
  });

  it('refuses a pool size that is not a positive integer', () => {
    expect(() =>
      loadAppConfig({ ...validEnv, DATABASE_POOL_SIZE: '0' }),
    ).toThrow('Invalid DATABASE_POOL_SIZE');
  });
});

describe('isOriginAllowed', () => {
  const allowed = ['http://localhost:4200'];

  it('allows requests that do not send an origin', () => {
    expect(isOriginAllowed(undefined, allowed)).toBe(true);
  });

  it('refuses an origin that is not on the list', () => {
    expect(isOriginAllowed('http://evil.example', allowed)).toBe(false);
  });
});

describe('loadEnvFile', () => {
  const original = process.env['PLATFORM_DOMAIN'];

  afterEach(() => {
    if (original === undefined) {
      delete process.env['PLATFORM_DOMAIN'];
    } else {
      process.env['PLATFORM_DOMAIN'] = original;
    }
  });

  it('does not override variables already present in the process', () => {
    process.env['PLATFORM_DOMAIN'] = 'already-set';
    const directory = mkdtempSync(join(tmpdir(), 'ciadelivery-env-'));
    const filePath = join(directory, '.env');
    writeFileSync(filePath, 'PLATFORM_DOMAIN=from-file\n', 'utf8');

    loadEnvFile(filePath);

    expect(process.env['PLATFORM_DOMAIN']).toBe('already-set');
  });
});
