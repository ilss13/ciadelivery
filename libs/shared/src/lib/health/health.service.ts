import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
import { APP_CONFIG, AppConfig } from '../app-config';

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async readiness(): Promise<{
    status: 'ok' | 'unavailable';
    httpStatus: 200 | 503;
  }> {
    const databaseReady = await this.pingDatabase();
    const redisReady = await this.pingRedis();
    if (databaseReady && redisReady) {
      return { status: 'ok', httpStatus: 200 };
    }

    return { status: 'unavailable', httpStatus: 503 };
  }

  private async pingDatabase(): Promise<boolean> {
    try {
      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
      }
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  private async pingRedis(): Promise<boolean> {
    const client = new Redis({
      host: this.config.redisHost,
      port: this.config.redisPort,
      lazyConnect: true,
      connectTimeout: 1500,
      commandTimeout: 1500,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });

    try {
      await client.connect();
      const result = await client.ping();
      return result === 'PONG';
    } catch {
      return false;
    } finally {
      client.disconnect();
    }
  }
}
