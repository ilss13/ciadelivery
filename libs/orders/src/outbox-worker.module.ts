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
import {
  OutboxHandlerRegistry,
  OutboxHandlerRegistryModule,
} from './infrastructure/outbox-handler-registry';
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
      imports: [
        OutboxHandlerRegistryModule,
        TypeOrmModule.forFeature([OutboxEventEntity, ProcessedEventEntity]),
      ],
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
            extra: unknown,
            backoffMs: (attempt: number) => number,
            registry: OutboxHandlerRegistry,
          ) =>
            new ProcessOutboxEvent(
              outbox,
              () => [...registry.handlers(), ...collectHandlers(extra), logging],
              backoffMs,
            ),
          inject: [
            OUTBOX_STORE,
            LoggingOutboxHandler,
            { token: OUTBOX_EXTRA_HANDLERS, optional: true },
            OUTBOX_BACKOFF,
            OutboxHandlerRegistry,
          ],
        },
        BullMqOutboxQueue,
        OutboxPoller,
      ],
      exports: [OutboxPoller, ProcessOutboxEvent, OUTBOX_STORE],
    };
  }
}

function collectHandlers(extra: unknown): OutboxHandler[] {
  if (!Array.isArray(extra)) {
    return [];
  }
  const handlers: OutboxHandler[] = [];
  for (const item of extra) {
    if (Array.isArray(item)) {
      for (const nested of item) {
        if (isHandler(nested)) {
          handlers.push(nested);
        }
      }
      continue;
    }
    if (isHandler(item)) {
      handlers.push(item);
    }
  }
  return handlers;
}

function isHandler(value: unknown): value is OutboxHandler {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { supports?: unknown; handle?: unknown };
  return typeof candidate.supports === 'function' && typeof candidate.handle === 'function';
}
