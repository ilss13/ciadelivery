import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '@ciadelivery/shared';
import { Queue } from 'bullmq';
import { TextDispatch } from '../domain/conversations.port';
import { WHATSAPP_OUTBOUND_QUEUE } from './whatsapp-status-queue';

@Injectable()
export class WhatsAppTextQueue implements TextDispatch, OnModuleInit, OnModuleDestroy {
  private queue: Queue | null = null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async onModuleInit(): Promise<void> {
    this.queue = new Queue(WHATSAPP_OUTBOUND_QUEUE, {
      connection: {
        host: this.config.redisHost,
        port: this.config.redisPort,
        maxRetriesPerRequest: null,
      },
      prefix: 'ciadelivery',
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    });
    await this.queue.waitUntilReady();
  }

  async enqueue(messageId: string): Promise<void> {
    if (this.queue === null) {
      throw new Error('The WhatsApp queue is not ready');
    }
    try {
      await this.queue.add(
        'text',
        { messageId },
        { jobId: `text-${messageId}` },
      );
    } catch (error) {
      if (!isDuplicateJob(error)) {
        throw error;
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
    this.queue = null;
  }
}

function isDuplicateJob(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /already exists|duplicate/i.test(error.message);
}
