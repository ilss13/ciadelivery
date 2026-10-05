import { JsonLogger } from '@ciadelivery/shared';
import { outboxFailureDecision } from '../domain/outbox-backoff';
import {
  OutboxHandler,
  OutboxStore,
  clipOutboxError,
} from '../domain/outbox';

export class ProcessOutboxEvent {
  private readonly logger = new JsonLogger();

  constructor(
    private readonly outbox: OutboxStore,
    private readonly handlers: readonly OutboxHandler[],
    private readonly backoffMs: (attempt: number) => number,
  ) {}

  async execute(eventId: string): Promise<void> {
    const event = await this.outbox.findById(eventId);
    if (event === null || event.status !== 'PROCESSING') {
      return;
    }

    try {
      for (const handler of this.handlers) {
        if (!handler.supports(event.type)) {
          continue;
        }
        await handler.handle(event);
      }
      await this.outbox.markProcessed(event.id, new Date());
    } catch (error) {
      const decision = outboxFailureDecision(
        event.attempts,
        new Date(),
        this.backoffMs,
      );
      await this.outbox.applyFailure(
        event.id,
        event.attempts,
        clipOutboxError(error),
        decision,
      );
      this.logger.error(
        `Outbox handler failed ${event.id} ${event.type}`,
        undefined,
        'ProcessOutboxEvent',
      );
    }
  }
}
