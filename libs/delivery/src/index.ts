export { DeliveryModule } from './delivery.module';
export { quoteFulfillment } from './application/quote-fulfillment';
export type { FulfillmentQuote } from './application/quote-fulfillment';
export { COURIERS } from './domain/couriers.port';
export type { Couriers } from './domain/couriers.port';
export { ASSIGNMENTS } from './domain/assignments.port';
export type { Assignments } from './domain/assignments.port';
export type { AssignmentRecord } from './domain/assignment';
export {
  assertCanDeliver,
  assertCanDispatch,
  assertCourierAssignable,
  assertOrderAssignable,
} from './domain/assignment';
export { DELIVERY_POLICIES } from './domain/delivery-policy';
export type {
  DeliveryPolicies,
  DeliveryPolicySnapshot,
} from './domain/delivery-policy';
export {
  assertDeliveryZones,
  haversineKm,
  quoteDeliveryDistance,
  resolveFee,
} from './domain/delivery-fee';
export type {
  DeliveryDistanceQuote,
  DeliveryFeeConfig,
  DeliveryFeeZone,
  DeliveryQuotePolicy,
  GeoPoint,
  ResolvedDeliveryFee,
} from './domain/delivery-fee';
