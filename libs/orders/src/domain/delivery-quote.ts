export type Fulfillment = 'DELIVERY' | 'PICKUP';

export interface DeliveryQuoteRequest {
  fulfillment: Fulfillment;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  flatFeeCents: number;
}

export interface DeliveryQuoteResult {
  feeCents: number;
  accepted: boolean;
  reason: string | null;
}

export interface DeliveryQuotePort {
  quote(input: DeliveryQuoteRequest): DeliveryQuoteResult;
}

export const DELIVERY_QUOTE = Symbol('DELIVERY_QUOTE');
