import { DomainException } from '@ciadelivery/shared';
import { OutboxStore } from '../domain/outbox';

export class RequeueOutbox {
  constructor(private readonly outbox: OutboxStore) {}

  async execute(id: string): Promise<{ id: string; status: 'PENDING' }> {
    const result = await this.outbox.requeue(id, new Date());
    if (result === 'missing') {
      throw new DomainException(
        'OUTBOX_NOT_FOUND',
        'The outbox event was not found',
        404,
      );
    }
    if (result === 'not_failed') {
      throw new DomainException(
        'OUTBOX_NOT_FAILED',
        'Only a failed outbox event can be requeued',
        409,
      );
    }
    return { id, status: 'PENDING' };
  }
}
