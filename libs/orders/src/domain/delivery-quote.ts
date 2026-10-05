import { AddressInput } from '@ciadelivery/shared';
import { DeliveryPolicySnapshot } from '@ciadelivery/delivery';

export type Fulfillment = 'DELIVERY' | 'PICKUP';

export interface DeliveryQuoteRequest {
  fulfillment: Fulfillment;
  policy: DeliveryPolicySnapshot | null;
  address: AddressInput | null;
}

export interface DeliveryQuoteResult {
  feeCents: number;
  accepted: boolean;
  reason: string | null;
  distanceKm: number | null;
  estimatedMinutes: number | null;
  latitude: number | null;
  longitude: number | null;
}

export interface DeliveryQuotePort {
  quote(input: DeliveryQuoteRequest): Promise<DeliveryQuoteResult>;
}

export const DELIVERY_QUOTE = Symbol('DELIVERY_QUOTE');
