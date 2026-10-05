import { createHash } from 'node:crypto';
import { DomainException } from '@ciadelivery/shared';
import { PublicOrder } from '../domain/order';
import { OrderRepository } from '../domain/order-repository';

export class GetPublicOrder {
  constructor(private readonly orders: OrderRepository) {}

  async execute(trackingToken: string): Promise<PublicOrder> {
    if (trackingToken.length === 0 || trackingToken.length > 256) {
      throw notFound();
    }
    const hash = createHash('sha256').update(trackingToken).digest('hex');
    const order = await this.orders.findByTrackingTokenHash(hash);
    if (order === null) {
      throw notFound();
    }
    return order;
  }
}

function notFound(): DomainException {
  return new DomainException(
    'ORDER_NOT_FOUND',
    'The order was not found',
    404,
  );
}
