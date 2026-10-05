import { Inject, Injectable } from '@nestjs/common';
import { JsonLogger } from '@ciadelivery/shared';
import {
  OutboxEventRecord,
  OutboxHandler,
  PROCESSED_EVENTS,
  ProcessedEventStore,
} from '../domain/outbox';

@Injectable()
export class LoggingOutboxHandler implements OutboxHandler {
  readonly name = 'log';
  private readonly logger = new JsonLogger();

  constructor(
    @Inject(PROCESSED_EVENTS) private readonly processed: ProcessedEventStore,
  ) {}

  supports(type: string): boolean {
    return type.length > 0;
  }

  async handle(event: OutboxEventRecord): Promise<void> {
    const inserted = await this.processed.record(
      event.id,
      this.name,
      new Date(),
    );
    if (!inserted) {
      return;
    }
    this.logger.log(
      `Outbox event processed ${event.id} ${event.type}`,
      'LoggingOutboxHandler',
    );
  }
}
