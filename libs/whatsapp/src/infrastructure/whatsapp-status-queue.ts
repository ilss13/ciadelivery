import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { APP_CONFIG, AppConfig, JsonLogger } from '@ciadelivery/shared';
import { Job, Queue, Worker } from 'bullmq';
import { NotifyOrderStatus } from '../application/notify-order-status';
import { SendQueuedText } from '../application/send-queued-text';

export const WHATSAPP_OUTBOUND_QUEUE = 'whatsapp-outbound';

interface StatusJob {
  eventId?: string;
  messageId?: string;
}

@Injectable()
export class WhatsAppStatusQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new JsonLogger();
  private queue: Queue<StatusJob> | null = null;
  private worker: Worker<StatusJob> | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly notify: NotifyOrderStatus,
    private readonly texts: SendQueuedText,
  ) {}

  async onModuleInit(): Promise<void> {
    const connection = {
      host: this.config.redisHost,
      port: this.config.redisPort,
      maxRetriesPerRequest: null,
    };
    const prefix = 'ciadelivery';
    this.queue = new Queue<StatusJob>(WHATSAPP_OUTBOUND_QUEUE, {
      connection,
      prefix,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    });
    this.worker = new Worker<StatusJob>(
      WHATSAPP_OUTBOUND_QUEUE,
      async (job: Job<StatusJob>) => {
        if (typeof job.data.messageId === 'string') {
          await this.texts.execute(job.data.messageId, job.attemptsMade + 1);
          return;
        }
        if (typeof job.data.eventId === 'string') {
          await this.notify.execute(job.data.eventId, job.attemptsMade + 1);
        }
      },
      { connection, prefix, concurrency: 4 },
    );
    this.worker.on('error', (error: Error) => {
      this.logger.error(error.message, undefined, 'WhatsAppStatusQueue');
    });
    await this.queue.waitUntilReady();
    await this.worker.waitUntilReady();
  }

  async enqueue(eventId: string): Promise<void> {
    if (this.queue === null) {
      throw new Error('The WhatsApp queue is not ready');
    }
    try {
      await this.queue.add('notify', { eventId }, { jobId: eventId });
    } catch (error) {
      if (!isDuplicateJob(error)) {
        throw error;
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    this.worker = null;
    this.queue = null;
  }
}

function isDuplicateJob(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /already exists|duplicate/i.test(error.message);
}
