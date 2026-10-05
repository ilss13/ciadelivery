import { Injectable } from '@nestjs/common';
import { OutboxEventRecord, OutboxHandler } from '@ciadelivery/orders';
import { PublishOrderRealtime } from '../application/publish-order-realtime';
import { isOrderRealtimeType } from '../domain/realtime';

@Injectable()
export class RealtimeOutboxHandler implements OutboxHandler {
  readonly name = 'realtime';

  constructor(private readonly publish: PublishOrderRealtime) {}

  supports(type: string): boolean {
    return isOrderRealtimeType(type);
  }

  handle(event: OutboxEventRecord): Promise<void> {
    return this.publish.execute({
      id: event.id,
      tenantId: event.tenantId,
      type: event.type,
      payload: event.payload,
    });
  }
}
