import { Injectable } from '@nestjs/common';
import { TransactionContext } from '@ciadelivery/tenancy/domain';
import {
  DomainEventDraft,
  DomainEventPublisher,
  assertSafeEventPayload,
} from '../domain/domain-event';
import { TypeOrmOutbox } from './typeorm-outbox';

@Injectable()
export class OutboxDomainEventPublisher implements DomainEventPublisher {
  constructor(private readonly outbox: TypeOrmOutbox) {}

  publish(event: DomainEventDraft, tx: TransactionContext): Promise<void> {
    assertSafeEventPayload(event.payload);
    return this.outbox.insert(event, tx);
  }
}
