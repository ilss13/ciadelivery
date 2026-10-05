import { FlatDeliveryQuote } from './flat-delivery-quote';

describe('FlatDeliveryQuote', () => {
  const quote = new FlatDeliveryQuote();

  it('charges the flat fee for delivery and nothing for pickup', () => {
    expect(
      quote.quote({
        fulfillment: 'DELIVERY',
        pickupEnabled: true,
        deliveryEnabled: true,
        flatFeeCents: 650,
      }),
    ).toEqual({ feeCents: 650, accepted: true, reason: null });
    expect(
      quote.quote({
        fulfillment: 'PICKUP',
        pickupEnabled: true,
        deliveryEnabled: true,
        flatFeeCents: 650,
      }),
    ).toEqual({ feeCents: 0, accepted: true, reason: null });
  });

  it('refuses a fulfillment the store has turned off', () => {
    expect(
      quote.quote({
        fulfillment: 'DELIVERY',
        pickupEnabled: true,
        deliveryEnabled: false,
        flatFeeCents: 650,
      }),
    ).toEqual({ feeCents: 0, accepted: false, reason: 'DELIVERY_DISABLED' });
    expect(
      quote.quote({
        fulfillment: 'PICKUP',
        pickupEnabled: false,
        deliveryEnabled: true,
        flatFeeCents: 0,
      }),
    ).toEqual({ feeCents: 0, accepted: false, reason: 'PICKUP_DISABLED' });
  });
});
