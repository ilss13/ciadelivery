import {
  AddressInput,
  DomainException,
  GeocodingProvider,
} from '@ciadelivery/shared';
import { haversineKm, resolveFee } from '../domain/delivery-fee';
import { DeliveryPolicySnapshot } from '../domain/delivery-policy';

export type QuoteFulfillment = 'DELIVERY' | 'PICKUP';

export interface FulfillmentQuote {
  fulfillment: QuoteFulfillment;
  accepted: boolean;
  distanceKm: number | null;
  feeCents: number;
  estimatedMinutes: number | null;
  reason: string | null;
  latitude: number | null;
  longitude: number | null;
}

export async function quoteFulfillment(
  geocoding: GeocodingProvider,
  input: {
    fulfillment: QuoteFulfillment;
    policy: DeliveryPolicySnapshot | null;
    address: AddressInput | null;
  },
): Promise<FulfillmentQuote> {
  const policy = input.policy;
  if (input.fulfillment === 'PICKUP') {
    if (policy === null || !policy.config.pickupEnabled) {
      return empty('PICKUP', 'PICKUP_DISABLED');
    }
    return {
      ...empty('PICKUP', null),
      accepted: true,
      estimatedMinutes: policy.config.estimatedMinutes,
    };
  }

  if (policy === null || !policy.config.deliveryEnabled) {
    return empty('DELIVERY', 'DELIVERY_DISABLED');
  }
  if (input.address === null) {
    throw new DomainException(
      'VALIDATION_ERROR',
      'The request payload is invalid',
      400,
    );
  }

  const originLatitude = policy.config.originLatitude;
  const originLongitude = policy.config.originLongitude;
  if (originLatitude === null || originLongitude === null) {
    throw new DomainException(
      'STORE_ORIGIN_MISSING',
      'The store origin is missing',
      422,
    );
  }

  const destination = await geocoding.geocode(input.address);
  const distanceKm = haversineKm(
    { latitude: originLatitude, longitude: originLongitude },
    destination,
  );
  const fee = resolveFee(policy.config, policy.zones, distanceKm);
  const shownDistance = Math.round(distanceKm * 100) / 100;
  if (!fee.ok) {
    return {
      fulfillment: 'DELIVERY',
      accepted: false,
      distanceKm: shownDistance,
      feeCents: 0,
      estimatedMinutes: policy.config.estimatedMinutes,
      reason: fee.reason,
      latitude: destination.latitude,
      longitude: destination.longitude,
    };
  }

  return {
    fulfillment: 'DELIVERY',
    accepted: true,
    distanceKm: shownDistance,
    feeCents: fee.feeCents,
    estimatedMinutes: policy.config.estimatedMinutes,
    reason: null,
    latitude: destination.latitude,
    longitude: destination.longitude,
  };
}

function empty(
  fulfillment: QuoteFulfillment,
  reason: string | null,
): FulfillmentQuote {
  return {
    fulfillment,
    accepted: false,
    distanceKm: null,
    feeCents: 0,
    estimatedMinutes: null,
    reason,
    latitude: null,
    longitude: null,
  };
}
