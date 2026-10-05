import {
  AddressInput,
  DomainException,
  GeocodingProvider,
  JsonLogger,
} from '@ciadelivery/shared';
import { CurrentStore, StoreRecord } from '@ciadelivery/stores';
import { currentTenant } from '@ciadelivery/tenancy/domain';
import { DeliveryPolicies } from '../domain/delivery-policy';
import { QuoteFulfillment, quoteFulfillment } from './quote-fulfillment';

const QUOTE_MESSAGES: Record<string, string> = {
  PICKUP_DISABLED: 'Pickup is not available',
  DELIVERY_DISABLED: 'Delivery is not available',
  DELIVERY_ZONE_NOT_FOUND: 'No delivery zone matches this distance',
};

export interface PublicDeliveryQuote {
  accepted: boolean;
  fulfillment: QuoteFulfillment;
  distanceKm: number | null;
  feeCents: number;
  estimatedMinutes: number | null;
  reason: string | null;
}

export class QuotePublicDelivery {
  private readonly logger = new JsonLogger();

  constructor(
    private readonly policies: DeliveryPolicies,
    private readonly stores: CurrentStore,
    private readonly geocoding: GeocodingProvider,
  ) {}

  async execute(input: {
    fulfillment: QuoteFulfillment | null;
    address: AddressInput | null;
  }): Promise<PublicDeliveryQuote> {
    const fulfillment =
      input.fulfillment ?? (input.address === null ? null : 'DELIVERY');
    if (fulfillment === null) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'The request payload is invalid',
        400,
      );
    }

    const store = await requireStore(this.stores);
    const policy = await this.policies.find(store.tenantId, store.id);
    const quote = await quoteFulfillment(this.geocoding, {
      fulfillment,
      policy,
      address: fulfillment === 'PICKUP' ? null : input.address,
    });
    if (!quote.accepted && quote.reason !== 'OUT_OF_AREA') {
      const reason = quote.reason ?? 'DELIVERY_UNAVAILABLE';
      throw new DomainException(
        reason,
        QUOTE_MESSAGES[reason] ?? 'Delivery is not available',
        422,
      );
    }

    this.logger.log(
      `Delivery quote ${store.id} ${quote.reason ?? 'accepted'}`,
      'QuotePublicDelivery',
    );
    return {
      accepted: quote.accepted,
      fulfillment: quote.fulfillment,
      distanceKm: quote.distanceKm,
      feeCents: quote.feeCents,
      estimatedMinutes: quote.estimatedMinutes,
      reason: quote.reason,
    };
  }
}

async function requireStore(stores: CurrentStore): Promise<StoreRecord> {
  const tenant = currentTenant();
  if (tenant === null) {
    throw new DomainException(
      'TENANT_NOT_FOUND',
      'The tenant was not found',
      404,
    );
  }
  const store = await stores.findForCurrentTenant();
  if (store === null || store.tenantId !== tenant.id) {
    throw new DomainException('STORE_NOT_FOUND', 'The store was not found', 404);
  }
  return store;
}
