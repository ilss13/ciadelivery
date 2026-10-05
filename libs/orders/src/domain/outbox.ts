import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { DomainEventDraft } from './domain-event';

export const OUTBOX_STATUSES = [
  'PENDING',
  'PROCESSING',
  'PROCESSED',
  'FAILED',
] as const;

export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

export const MAX_OUTBOX_ATTEMPTS = 5;

export const QUEUE_NAMES = [
  'notifications',
  'whatsapp-outbound',
  'outbox-events',
  'order-events',
  'audit-processing',
  'maintenance',
] as const;

export const OUTBOX_QUEUE = 'outbox-events';

export function isOutboxStatus(value: string): value is OutboxStatus {
  return (OUTBOX_STATUSES as readonly string[]).includes(value);
}

export interface OutboxEventRecord {
  id: string;
  tenantId: string;
  aggregateType: string;
  aggregateId: string;
  type: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  availableAt: Date;
  processedAt: Date | null;
  lastError: string | null;
  lockedBy: string | null;
  createdAt: Date;
}

export interface OutboxFailureDecision {
  attempts: number;
  status: 'PENDING' | 'FAILED';
  availableAt: Date;
}

export interface OutboxStore {
  insert(event: DomainEventDraft, tx: TransactionContext): Promise<void>;
  claimPending(lockedBy: string, limit: number, now: Date): Promise<string[]>;
  releaseClaim(id: string): Promise<void>;
  findById(id: string): Promise<OutboxEventRecord | null>;
  markProcessed(id: string, processedAt: Date): Promise<void>;
  applyFailure(
    id: string,
    expectedAttempts: number,
    lastError: string,
    decision: OutboxFailureDecision,
  ): Promise<void>;
  requeue(id: string, availableAt: Date): Promise<'requeued' | 'missing' | 'not_failed'>;
}

export const OUTBOX_STORE = Symbol('OUTBOX_STORE');

export interface ProcessedEventStore {
  record(eventId: string, handler: string, processedAt: Date): Promise<boolean>;
}

export const PROCESSED_EVENTS = Symbol('PROCESSED_EVENTS');

export interface OutboxHandler {
  readonly name: string;
  supports(type: string): boolean;
  handle(event: OutboxEventRecord): Promise<void>;
}

export const OUTBOX_BACKOFF = Symbol('OUTBOX_BACKOFF');
export const OUTBOX_EXTRA_HANDLERS = Symbol('OUTBOX_EXTRA_HANDLERS');
export const OUTBOX_POLL_INTERVAL_MS = Symbol('OUTBOX_POLL_INTERVAL_MS');

export interface OutboxQueue {
  enqueue(eventId: string): Promise<void>;
}

export function clipOutboxError(error: unknown): string {
  const message =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : 'The outbox handler failed';
  const single = message.replace(/\s+/g, ' ').trim();
  return single.slice(0, 500);
}
