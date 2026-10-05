import { Injectable } from '@nestjs/common';
import { OutboxEventRecord, OutboxHandler } from '@ciadelivery/orders';
import { templateKeyForEvent } from '../domain/order-templates';
import { WhatsAppStatusQueue } from './whatsapp-status-queue';

@Injectable()
export class OrderStatusOutboxHandler implements OutboxHandler {
  readonly name = 'whatsapp-order-status';

  constructor(private readonly queue: WhatsAppStatusQueue) {}

  supports(type: string): boolean {
    return templateKeyForEvent(type) !== undefined;
  }

  handle(event: OutboxEventRecord): Promise<void> {
    return this.queue.enqueue(event.id);
  }
}
