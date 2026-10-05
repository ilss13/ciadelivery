import { CustomerRepository, PaymentMethodView } from '@ciadelivery/customers';
import { DeliveryPolicies } from '@ciadelivery/delivery';
import { CurrentStore } from '@ciadelivery/stores';
import { requireStore } from './order-checks';

export interface PublicCheckoutOptions {
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  paymentMethods: PaymentMethodView[];
}

export class GetPublicCheckout {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly stores: CurrentStore,
    private readonly policies: DeliveryPolicies,
  ) {}

  async execute(): Promise<PublicCheckoutOptions> {
    const store = await requireStore(this.stores);
    const methods = await this.customers.listPaymentMethods({
      tenantId: store.tenantId,
      storeId: store.id,
    });
    const policy = await this.policies.find(store.tenantId, store.id);
    return {
      pickupEnabled: policy?.config.pickupEnabled ?? false,
      deliveryEnabled: policy?.config.deliveryEnabled ?? false,
      paymentMethods: methods
        .filter((method) => method.enabled)
        .map((method) => ({
          code: method.code,
          label: method.label,
          instructions: method.instructions,
          enabled: method.enabled,
          sortOrder: method.sortOrder,
        })),
    };
  }
}
