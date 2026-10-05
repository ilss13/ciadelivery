import { CartValidation } from '@ciadelivery/catalog';
import { DomainException } from '@ciadelivery/shared';
import { CurrentStore, StoreRecord } from '@ciadelivery/stores';
import { currentTenant } from '@ciadelivery/tenancy/domain';
import {
  DeliveryQuoteResult,
  Fulfillment,
} from '../domain/delivery-quote';
import { OrderAddressDraft } from '../domain/order';

const QUOTE_MESSAGES: Record<string, string> = {
  PICKUP_DISABLED: 'Pickup is not available',
  DELIVERY_DISABLED: 'Delivery is not available',
  DELIVERY_UNAVAILABLE: 'Delivery is not available',
  OUT_OF_AREA: 'The address is outside the delivery area',
  DELIVERY_ZONE_NOT_FOUND: 'No delivery zone matches this distance',
  STORE_ORIGIN_MISSING: 'The store origin is missing',
  ADDRESS_NOT_FOUND: 'The address was not found',
};

export function assertCart(cart: CartValidation): void {
  if (cart.valid) {
    return;
  }
  const structural = cart.errors.some(
    (error) =>
      error.code !== 'STORE_CLOSED' && error.code !== 'MINIMUM_ORDER_NOT_MET',
  );
  if (structural) {
    throw new DomainException(
      'CART_INVALID',
      'The cart is invalid',
      422,
      cart.errors,
    );
  }
  if (cart.errors.some((error) => error.code === 'STORE_CLOSED')) {
    throw new DomainException(
      'STORE_CLOSED',
      'The store is closed',
      422,
      cart.errors,
    );
  }
  throw new DomainException(
    'MINIMUM_ORDER_NOT_MET',
    'The order is below the minimum',
    422,
    cart.errors,
  );
}

export function assertQuote(quote: DeliveryQuoteResult): void {
  if (quote.accepted) {
    return;
  }
  const reason = quote.reason ?? 'DELIVERY_UNAVAILABLE';
  throw new DomainException(
    reason,
    QUOTE_MESSAGES[reason] ?? 'Delivery is not available',
    422,
  );
}

export function resolveAddress(
  fulfillment: Fulfillment,
  address: OrderAddressDraft | null,
): OrderAddressDraft | null {
  if (fulfillment === 'PICKUP') {
    return null;
  }
  if (address === null) {
    throw new DomainException(
      'VALIDATION_ERROR',
      'The request payload is invalid',
      400,
    );
  }
  return address;
}

export async function requireStore(stores: CurrentStore): Promise<StoreRecord> {
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
