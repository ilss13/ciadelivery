import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { APP_CONFIG, AppConfig, JsonLogger } from '@ciadelivery/shared';
import Redis from 'ioredis';
import { ConversationEvents } from '../domain/conversations.port';
import { ConversationMode } from '../domain/conversation';

const REALTIME_CHANNEL = 'realtime';

@Injectable()
export class RedisConversationEvents
  implements ConversationEvents, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new JsonLogger();
  private redis: Redis | null = null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async onModuleInit(): Promise<void> {
    this.redis = new Redis({
      host: this.config.redisHost,
      port: this.config.redisPort,
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    this.redis.on('error', (error: Error) => {
      this.logger.error(error.message, undefined, 'RedisConversationEvents');
    });
    await this.redis.connect();
  }

  async messageReceived(input: {
    storeId: string;
    conversationId: string;
    messageId: string;
    body: string;
    createdAt: Date;
  }): Promise<void> {
    if (this.redis === null) {
      throw new Error('The conversation publisher is not ready');
    }
    const message = {
      event: 'conversation.message_received',
      rooms: [`store:${input.storeId}`, `conversation:${input.conversationId}`],
      payload: {
        conversationId: input.conversationId,
        messageId: input.messageId,
        storeId: input.storeId,
        direction: 'IN',
        author: 'CUSTOMER',
        body: input.body,
        createdAt: input.createdAt.toISOString(),
      },
    };
    await this.redis.publish(REALTIME_CHANNEL, JSON.stringify(message));
  }

  async modeChanged(input: {
    storeId: string;
    conversationId: string;
    mode: ConversationMode;
    reason: string;
  }): Promise<void> {
    if (this.redis === null) {
      throw new Error('The conversation publisher is not ready');
    }
    await this.redis.publish(
      REALTIME_CHANNEL,
      JSON.stringify({
        event: 'conversation.mode_changed',
        rooms: [`store:${input.storeId}`, `conversation:${input.conversationId}`],
        payload: input,
      }),
    );
  }

  async onModuleDestroy(): Promise<void> {
    const redis = this.redis;
    this.redis = null;
    if (redis === null) {
      return;
    }
    redis.removeAllListeners();
    redis.on('error', () => undefined);
    redis.disconnect();
  }
}
