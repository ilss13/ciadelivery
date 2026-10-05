export { requireActorStore } from './application/actor-store';
export { CustomersModule } from './customers.module';
export { CUSTOMERS } from './domain/customer-repository';
export type { CustomerRepository } from './domain/customer-repository';
export type {
  CustomerAddressRecord,
  CustomerConsentRecord,
  CustomerRecord,
  CustomerScope,
} from './domain/customer';
export { normalizeBrazilPhone } from './domain/phone';
export { PAYMENT_METHOD_CODES } from './domain/payment-method';
export type { PaymentMethodView } from './domain/payment-method';
