import { createDataSourceOptions, loadAppConfig } from '@ciadelivery/shared';

describe('createDataSourceOptions', () => {
  it('keeps synchronize disabled and applies the pool size', () => {
    const options = createDataSourceOptions(
      loadAppConfig({
        NODE_ENV: 'local',
        API_PORT: '3000',
        WORKER_PORT: '3001',
        DATABASE_HOST: 'localhost',
        DATABASE_PORT: '3306',
        DATABASE_USER: 'ciadelivery',
        DATABASE_PASSWORD: 'ciadelivery',
        DATABASE_NAME: 'ciadelivery',
        DATABASE_POOL_SIZE: '15',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        PLATFORM_DOMAIN: 'localhost',
        JWT_ACCESS_SECRET: 'local-development-jwt-access-secret',
        CORS_ORIGINS: 'http://localhost:4200',
      }),
    );

    expect(options).toMatchObject({
      type: 'mysql',
      synchronize: false,
      extra: { connectionLimit: 15 },
    });
  });
});
