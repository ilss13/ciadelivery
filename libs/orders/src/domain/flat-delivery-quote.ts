import {
  DeliveryQuotePort,
  DeliveryQuoteRequest,
  DeliveryQuoteResult,
} from './delivery-quote';

export class FlatDeliveryQuote implements DeliveryQuotePort {
  quote(input: DeliveryQuoteRequest): DeliveryQuoteResult {
    if (input.fulfillment === 'PICKUP') {
      if (!input.pickupEnabled) {
        return { feeCents: 0, accepted: false, reason: 'PICKUP_DISABLED' };
      }
      return { feeCents: 0, accepted: true, reason: null };
    }

    if (!input.deliveryEnabled) {
      return { feeCents: 0, accepted: false, reason: 'DELIVERY_DISABLED' };
    }
    if (!Number.isInteger(input.flatFeeCents) || input.flatFeeCents < 0) {
      return { feeCents: 0, accepted: false, reason: 'DELIVERY_UNAVAILABLE' };
    }
    return {
      feeCents: input.flatFeeCents,
      accepted: true,
      reason: null,
    };
  }
}
