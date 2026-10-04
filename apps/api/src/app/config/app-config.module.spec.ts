import { Test } from '@nestjs/testing';
import { AppConfigModule } from '@ciadelivery/shared';

const requiredEnv = {
  NODE_ENV: 'staging',
  API_PORT: '3000',
  WORKER_PORT: '3001',
  DATABASE_HOST: 'mysql',
  DATABASE_PORT: '3306',
  DATABASE_USER: 'ciadelivery',
  DATABASE_PASSWORD: '',
  DATABASE_NAME: 'ciadelivery',
  REDIS_HOST: 'redis',
  REDIS_PORT: '6379',
  PLATFORM_DOMAIN: 'localhost',
  JWT_ACCESS_SECRET: 'local-development-jwt-access-secret',
  CORS_ORIGINS: 'http://localhost:4200',
};

describe('AppConfigModule', () => {
  const snapshot = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, snapshot);
  });

  it('refuses to start when DATABASE_PASSWORD is empty', async () => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, requiredEnv);

    await expect(
      Test.createTestingModule({ imports: [AppConfigModule] }).compile(),
    ).rejects.toThrow('DATABASE_PASSWORD');
  });

  it('refuses to start when CORS_ORIGINS is missing', async () => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, {
      ...requiredEnv,
      DATABASE_PASSWORD: 'ciadelivery',
      CORS_ORIGINS: '   ',
    });

    await expect(
      Test.createTestingModule({ imports: [AppConfigModule] }).compile(),
    ).rejects.toThrow('CORS_ORIGINS');
  });
});
