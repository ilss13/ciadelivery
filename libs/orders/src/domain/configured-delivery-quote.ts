import { quoteFulfillment } from '@ciadelivery/delivery';
import { GeocodingProvider } from '@ciadelivery/shared';
import {
  DeliveryQuotePort,
  DeliveryQuoteRequest,
  DeliveryQuoteResult,
} from './delivery-quote';

export class ConfiguredDeliveryQuote implements DeliveryQuotePort {
  constructor(private readonly geocoding: GeocodingProvider) {}

  async quote(input: DeliveryQuoteRequest): Promise<DeliveryQuoteResult> {
    const quoted = await quoteFulfillment(this.geocoding, input);
    return {
      feeCents: quoted.feeCents,
      accepted: quoted.accepted,
      reason: quoted.reason,
      distanceKm: quoted.distanceKm,
      estimatedMinutes: quoted.estimatedMinutes,
      latitude: quoted.latitude,
      longitude: quoted.longitude,
    };
  }
}
