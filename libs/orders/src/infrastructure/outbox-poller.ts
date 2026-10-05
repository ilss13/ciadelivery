import { randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { JsonLogger } from '@ciadelivery/shared';
import { OUTBOX_POLL_INTERVAL_MS, OUTBOX_STORE, OutboxStore } from '../domain/outbox';
import { BullMqOutboxQueue } from './bullmq-outbox-queue';

@Injectable()
export class OutboxPoller implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new JsonLogger();
  private timer: NodeJS.Timeout | null = null;
  private tail: Promise<void> = Promise.resolve();

  constructor(
    @Inject(OUTBOX_STORE) private readonly outbox: OutboxStore,
    private readonly queue: BullMqOutboxQueue,
    @Inject(OUTBOX_POLL_INTERVAL_MS) private readonly intervalMs: number,
  ) {}

  onModuleInit(): void {
    if (this.intervalMs <= 0) {
      return;
    }
    this.timer = setInterval(() => {
      void this.pollOnce();
    }, this.intervalMs);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.tail;
  }

  pollOnce(): Promise<number> {
    const run = this.tail.then(() => this.claimAndEnqueue());
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async claimAndEnqueue(): Promise<number> {
    try {
      const ids = await this.outbox.claimPending(randomUUID(), 20, new Date());
      for (const id of ids) {
        try {
          await this.queue.enqueue(id);
        } catch (error) {
          await this.outbox.releaseClaim(id);
          const message = error instanceof Error ? error.message : 'enqueue failed';
          this.logger.error(
            `Outbox enqueue failed ${id} ${message}`,
            undefined,
            'OutboxPoller',
          );
        }
      }
      return ids.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'poll failed';
      this.logger.error(message, undefined, 'OutboxPoller');
      return 0;
    }
  }
}
