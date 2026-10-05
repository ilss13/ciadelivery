import { defaultBackoffMs, outboxFailureDecision } from './outbox-backoff';

describe('outbox backoff', () => {
  const now = new Date('2026-10-04T12:00:00.000Z');

  it('uses 2s, 4s, 8s, 16s and 32s', () => {
    expect(defaultBackoffMs(1)).toBe(2_000);
    expect(defaultBackoffMs(2)).toBe(4_000);
    expect(defaultBackoffMs(3)).toBe(8_000);
    expect(defaultBackoffMs(4)).toBe(16_000);
    expect(defaultBackoffMs(5)).toBe(32_000);
  });

  it('returns the event to the queue until the fifth failure', () => {
    const first = outboxFailureDecision(0, now, defaultBackoffMs);
    expect(first).toEqual({
      attempts: 1,
      status: 'PENDING',
      availableAt: new Date('2026-10-04T12:00:02.000Z'),
    });

    const fourth = outboxFailureDecision(3, now, defaultBackoffMs);
    expect(fourth.status).toBe('PENDING');
    expect(fourth.attempts).toBe(4);
    expect(fourth.availableAt.toISOString()).toBe('2026-10-04T12:00:16.000Z');

    const fifth = outboxFailureDecision(4, now, defaultBackoffMs);
    expect(fifth).toEqual({
      attempts: 5,
      status: 'FAILED',
      availableAt: now,
    });
  });
});
