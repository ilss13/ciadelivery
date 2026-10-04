import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { APP_CONFIG, AppConfig, DomainException } from '@ciadelivery/shared';
import Redis from 'ioredis';
import {
  LOGIN_RATE_LIMIT,
  LOGIN_RATE_WINDOW_SECONDS,
} from '../domain/auth-policy';
import { LoginRateLimit } from '../domain/auth-sessions';

const CONSUME_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
return current
`;

@Injectable()
export class RedisLoginRateLimit implements LoginRateLimit, OnModuleDestroy {
  private readonly redis: Redis;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.redis = new Redis({
      host: config.redisHost,
      port: config.redisPort,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  async consume(ip: string): Promise<void> {
    const count = await this.redis.eval(
      CONSUME_SCRIPT,
      1,
      `auth:login:ip:${ip}`,
      String(LOGIN_RATE_WINDOW_SECONDS),
    );
    if (Number(count) > LOGIN_RATE_LIMIT) {
      throw new DomainException('RATE_LIMITED', 'Too many requests', 429);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect();
  }
}
