import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessOutboxEvent } from './application/process-outbox-event';
import { defaultBackoffMs } from './domain/outbox-backoff';
import {
  OUTBOX_BACKOFF,
  OUTBOX_EXTRA_HANDLERS,
  OUTBOX_POLL_INTERVAL_MS,
  OUTBOX_STORE,
  OutboxHandler,
  OutboxStore,
  PROCESSED_EVENTS,
} from './domain/outbox';
import { BullMqOutboxQueue } from './infrastructure/bullmq-outbox-queue';
import { LoggingOutboxHandler } from './infrastructure/logging-outbox-handler';
import { OutboxEventEntity, ProcessedEventEntity } from './infrastructure/outbox.entities';
import { OutboxPoller } from './infrastructure/outbox-poller';
import {
  TypeOrmOutbox,
  TypeOrmProcessedEvents,
} from './infrastructure/typeorm-outbox';

export interface OutboxWorkerOptions {
  backoffMs?: (attempt: number) => number;
  extraHandlers?: readonly OutboxHandler[];
  pollIntervalMs?: number;
}

@Module({})
export class OutboxWorkerModule {
  static register(options: OutboxWorkerOptions = {}): DynamicModule {
    return {
      module: OutboxWorkerModule,
      imports: [TypeOrmModule.forFeature([OutboxEventEntity, ProcessedEventEntity])],
      providers: [
        TypeOrmOutbox,
        { provide: OUTBOX_STORE, useExisting: TypeOrmOutbox },
        TypeOrmProcessedEvents,
        { provide: PROCESSED_EVENTS, useExisting: TypeOrmProcessedEvents },
        LoggingOutboxHandler,
        {
          provide: OUTBOX_BACKOFF,
          useValue: options.backoffMs ?? defaultBackoffMs,
        },
        ...(options.extraHandlers === undefined
          ? []
          : [
              {
                provide: OUTBOX_EXTRA_HANDLERS,
                useValue: options.extraHandlers,
              },
            ]),
        {
          provide: OUTBOX_POLL_INTERVAL_MS,
          useValue: options.pollIntervalMs ?? 1000,
        },
        {
          provide: ProcessOutboxEvent,
          useFactory: (
            outbox: OutboxStore,
            logging: LoggingOutboxHandler,
            extra: readonly OutboxHandler[] | undefined,
            backoffMs: (attempt: number) => number,
          ) => new ProcessOutboxEvent(outbox, [...(extra ?? []), logging], backoffMs),
          inject: [
            OUTBOX_STORE,
            LoggingOutboxHandler,
            { token: OUTBOX_EXTRA_HANDLERS, optional: true },
            OUTBOX_BACKOFF,
          ],
        },
        BullMqOutboxQueue,
        OutboxPoller,
      ],
      exports: [OutboxPoller, ProcessOutboxEvent, OUTBOX_STORE],
    };
  }
}
