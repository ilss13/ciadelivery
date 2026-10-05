import { ValidatePublicCart } from '@ciadelivery/catalog';
import { CustomerRepository } from '@ciadelivery/customers';
import { DeliveryPolicies } from '@ciadelivery/delivery';
import { DomainException } from '@ciadelivery/shared';
import { CurrentStore } from '@ciadelivery/stores';
import { DeliveryQuotePort, Fulfillment } from '../domain/delivery-quote';
import { OrderAddressDraft, OrderReview } from '../domain/order';
import {
  assertCart,
  assertQuote,
  requireStore,
  resolveAddress,
} from './order-checks';

export interface ReviewOrderInput {
  fulfillment: Fulfillment;
  address: OrderAddressDraft | null;
  paymentMethodCode: string;
  items: readonly {
    productId: string;
    quantity: number;
    optionIds: readonly string[];
    notes: string | null;
  }[];
}

export class ReviewPublicOrder {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly stores: CurrentStore,
    private readonly policies: DeliveryPolicies,
    private readonly carts: ValidatePublicCart,
    private readonly quotes: DeliveryQuotePort,
  ) {}

  async execute(input: ReviewOrderInput): Promise<OrderReview> {
    const store = await requireStore(this.stores);
    const address = resolveAddress(input.fulfillment, input.address);
    const cart = await this.carts.execute(
      input.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        optionIds: [...item.optionIds],
        notes: item.notes,
      })),
    );
    assertCart(cart);

    const methods = await this.customers.listPaymentMethods({
      tenantId: store.tenantId,
      storeId: store.id,
    });
    const method = methods.find(
      (candidate) => candidate.code === input.paymentMethodCode && candidate.enabled,
    );
    if (method === undefined) {
      throw new DomainException(
        'PAYMENT_METHOD_DISABLED',
        'The payment method is disabled',
        422,
      );
    }

    const policy = await this.policies.find(store.tenantId, store.id);
    const quote = await this.quotes.quote({
      fulfillment: input.fulfillment,
      policy,
      address,
    });
    assertQuote(quote);

    return {
      items: cart.items.map((item) => ({
        productName: item.name,
        quantity: item.quantity,
        notes: item.notes,
        options: item.options.map((option) => ({
          optionId: option.id,
          groupName: option.groupName,
          name: option.name,
          priceCents: option.priceCents,
        })),
        subtotalCents: item.subtotalCents,
      })),
      subtotalCents: cart.subtotalCents,
      deliveryFeeCents: quote.feeCents,
      totalCents: cart.subtotalCents + quote.feeCents,
      paymentLabel: method.label,
      paymentInstructions: method.instructions,
    };
  }
}
