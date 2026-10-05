import { MAX_OUTBOX_ATTEMPTS, OutboxFailureDecision } from './outbox';

const BACKOFF_MS = [2_000, 4_000, 8_000, 16_000, 32_000] as const;

export function defaultBackoffMs(attempt: number): number {
  const index = Math.min(Math.max(attempt, 1), BACKOFF_MS.length) - 1;
  return BACKOFF_MS[index] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
}

export function outboxFailureDecision(
  currentAttempts: number,
  now: Date,
  backoffMs: (attempt: number) => number,
): OutboxFailureDecision {
  const attempts = currentAttempts + 1;
  const failed = attempts >= MAX_OUTBOX_ATTEMPTS;
  return {
    attempts,
    status: failed ? 'FAILED' : 'PENDING',
    availableAt: failed ? now : new Date(now.getTime() + backoffMs(attempts)),
  };
}
