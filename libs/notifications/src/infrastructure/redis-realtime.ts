import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { APP_CONFIG, AppConfig, JsonLogger } from '@ciadelivery/shared';
import Redis from 'ioredis';
import { RealtimePublisher } from '../domain/notification';
import { parseRealtimeEnvelope, REALTIME_CHANNEL, RealtimeEnvelope } from '../domain/realtime';

@Injectable()
export class RedisRealtimePublisher
  implements RealtimePublisher, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new JsonLogger();
  private redis: Redis | null = null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async onModuleInit(): Promise<void> {
    this.redis = this.connect('RedisRealtimePublisher');
    await this.redis.connect();
  }

  async publish(message: RealtimeEnvelope): Promise<void> {
    if (this.redis === null) {
      throw new Error('The realtime publisher is not ready');
    }
    await this.redis.publish(REALTIME_CHANNEL, JSON.stringify(message));
  }

  async onModuleDestroy(): Promise<void> {
    closeRedis(this.redis);
    this.redis = null;
  }

  private connect(context: string): Redis {
    const redis = new Redis({
      host: this.config.redisHost,
      port: this.config.redisPort,
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    redis.on('error', (error: Error) => {
      this.logger.error(error.message, undefined, context);
    });
    return redis;
  }
}

@Injectable()
export class RedisRealtimeSubscriber implements OnModuleDestroy {
  private readonly logger = new JsonLogger();
  private redis: Redis | null = null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async listen(onMessage: (message: RealtimeEnvelope) => void): Promise<void> {
    if (this.redis !== null) {
      return;
    }
    const redis = new Redis({
      host: this.config.redisHost,
      port: this.config.redisPort,
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    redis.on('error', (error: Error) => {
      this.logger.error(error.message, undefined, 'RedisRealtimeSubscriber');
    });
    await redis.connect();
    redis.on('message', (channel: string, raw: string) => {
      if (channel !== REALTIME_CHANNEL) {
        return;
      }
      const message = parseRealtimeEnvelope(raw);
      if (message === null) {
        return;
      }
      onMessage(message);
    });
    await redis.subscribe(REALTIME_CHANNEL);
    this.redis = redis;
  }

  async onModuleDestroy(): Promise<void> {
    closeRedis(this.redis);
    this.redis = null;
  }
}

function closeRedis(redis: Redis | null): void {
  if (redis === null) {
    return;
  }
  redis.removeAllListeners();
  redis.on('error', () => undefined);
  redis.disconnect();
}
