import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { APP_CONFIG, AppConfig, JsonLogger } from '@ciadelivery/shared';
import { Job, Queue, Worker } from 'bullmq';
import { ProcessOutboxEvent } from '../application/process-outbox-event';
import { OUTBOX_QUEUE, OutboxQueue, QUEUE_NAMES } from '../domain/outbox';

interface OutboxJob {
  eventId: string;
}

@Injectable()
export class BullMqOutboxQueue
  implements OutboxQueue, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new JsonLogger();
  private queue: Queue<OutboxJob> | null = null;
  private worker: Worker<OutboxJob> | null = null;
  private readonly declared: Queue[] = [];

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly processor: ProcessOutboxEvent,
  ) {}

  async onModuleInit(): Promise<void> {
    const connection = {
      host: this.config.redisHost,
      port: this.config.redisPort,
      maxRetriesPerRequest: null,
    };
    const prefix = 'ciadelivery';
    for (const name of QUEUE_NAMES) {
      if (name === OUTBOX_QUEUE) {
        continue;
      }
      const queue = new Queue(name, { connection, prefix });
      await queue.waitUntilReady();
      this.declared.push(queue);
    }
    this.queue = new Queue<OutboxJob>(OUTBOX_QUEUE, { connection, prefix });
    this.worker = new Worker<OutboxJob>(
      OUTBOX_QUEUE,
      async (job: Job<OutboxJob>) => {
        await this.processor.execute(job.data.eventId);
      },
      { connection, prefix, concurrency: 4 },
    );
    this.worker.on('error', (error: Error) => {
      this.logger.error(error.message, undefined, 'BullMqOutboxQueue');
    });
    await this.queue.waitUntilReady();
    await this.worker.waitUntilReady();
  }

  async enqueue(eventId: string): Promise<void> {
    if (this.queue === null) {
      throw new Error('The outbox queue is not ready');
    }
    try {
      await this.queue.add(
        'deliver',
        { eventId },
        {
          jobId: eventId,
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    } catch (error) {
      if (!isDuplicateJob(error)) {
        throw error;
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await Promise.all(this.declared.map((queue) => queue.close()));
    this.worker = null;
    this.queue = null;
    this.declared.length = 0;
  }
}

function isDuplicateJob(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /already exists|duplicate/i.test(error.message);
}
