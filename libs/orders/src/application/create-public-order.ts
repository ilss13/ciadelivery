import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ValidatePublicCart } from '@ciadelivery/catalog';
import {
  CustomerAddressRecord,
  CustomerRecord,
  CustomerRepository,
  normalizeBrazilPhone,
} from '@ciadelivery/customers';
import { DeliveryPolicies } from '@ciadelivery/delivery';
import { DomainException, JsonLogger, observeCounter } from '@ciadelivery/shared';
import { CurrentStore } from '@ciadelivery/stores';
import { TransactionContext, UnitOfWork } from '@ciadelivery/tenancy/domain';
import {
  DeliveryQuotePort,
  DeliveryQuoteResult,
  Fulfillment,
} from '../domain/delivery-quote';
import {
  CreatedOrder,
  OrderAddress,
  OrderAddressDraft,
  trackingPath,
} from '../domain/order';
import { DomainEventPublisher } from '../domain/domain-event';
import { ORDER_CREATED_EVENT } from '../domain/order-command';
import { OrderRepository } from '../domain/order-repository';
import { orderEvent } from './order-events';
import {
  assertCart,
  assertQuote,
  requireStore,
  resolveAddress,
} from './order-checks';

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
  optionIds: readonly string[];
  notes: string | null;
}

export interface CreateOrderInput {
  customer: { name: string; phone: string };
  fulfillment: Fulfillment;
  address: OrderAddressDraft | null;
  paymentMethodCode: string;
  notes: string | null;
  consents: {
    operational: boolean;
    marketing: boolean;
    policyVersion: string;
  };
  items: readonly CreateOrderItemInput[];
}

export interface CreateOrderMeta {
  idempotencyKey: string | undefined;
  ip: string;
  userAgent: string;
}

export class CreatePublicOrder {
  private readonly logger = new JsonLogger();

  constructor(
    private readonly customers: CustomerRepository,
    private readonly stores: CurrentStore,
    private readonly policies: DeliveryPolicies,
    private readonly carts: ValidatePublicCart,
    private readonly quotes: DeliveryQuotePort,
    private readonly orders: OrderRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(
    input: CreateOrderInput,
    meta: CreateOrderMeta,
  ): Promise<CreatedOrder> {
    const store = await requireStore(this.stores);
    const idempotencyKey = readIdempotencyKey(meta.idempotencyKey);
    const phone = normalizeBrazilPhone(input.customer.phone);
    const name = input.customer.name.trim();
    const requestHash = hashRequest({ ...input, customer: { name, phone } });
    const scope = { tenantId: store.tenantId, storeId: store.id };

    let createdNew = false;
    const created = await this.withDeadlockRetry(() =>
      this.unitOfWork.run(async (tx) => {
      const claim = await this.orders.claimIdempotency(
        {
          tenantId: scope.tenantId,
          key: idempotencyKey,
          requestHash,
          statusCode: 0,
          responseBody: null,
          createdAt: new Date(),
        },
        tx,
      );
      if (claim !== 'claimed') {
        if (claim.requestHash !== requestHash) {
          throw new DomainException(
            'IDEMPOTENCY_CONFLICT',
            'The idempotency key was reused with a different request',
            409,
          );
        }
        if (claim.statusCode !== 201 || claim.responseBody === null) {
          throw new DomainException(
            'IDEMPOTENCY_IN_PROGRESS',
            'The request is already in progress',
            409,
          );
        }
        return claim.responseBody;
      }

      const customer = await this.resolveCustomer(scope, name, phone, tx);
      if (!input.consents.operational) {
        throw new DomainException(
          'CONSENT_REQUIRED',
          'Operational consent is required',
          400,
        );
      }
      const now = new Date();
      const audit = {
        ip: clip(meta.ip, 64),
        userAgent: clip(meta.userAgent, 512),
      };
      await this.customers.insertConsents(
        [
          {
            id: randomUUID(),
            tenantId: scope.tenantId,
            customerId: customer.id,
            purpose: 'OPERATIONAL',
            granted: true,
            policyVersion: input.consents.policyVersion,
            ip: audit.ip,
            userAgent: audit.userAgent,
            createdAt: now,
          },
          {
            id: randomUUID(),
            tenantId: scope.tenantId,
            customerId: customer.id,
            purpose: 'MARKETING',
            granted: input.consents.marketing,
            policyVersion: input.consents.policyVersion,
            ip: audit.ip,
            userAgent: audit.userAgent,
            createdAt: now,
          },
        ],
        tx,
      );

      const cart = await this.carts.execute(
        input.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          optionIds: [...item.optionIds],
          notes: item.notes,
        })),
      );
      assertCart(cart);

      const method = await this.customers.findPaymentMethod(
        scope,
        input.paymentMethodCode,
        tx,
      );
      if (method === null || !method.enabled) {
        throw new DomainException(
          'PAYMENT_METHOD_DISABLED',
          'The payment method is disabled',
          422,
        );
      }

      const policy = await this.policies.find(store.tenantId, store.id);
      const addressInput = resolveAddress(input.fulfillment, input.address);
      const quote = await this.quotes.quote({
        fulfillment: input.fulfillment,
        policy,
        address: addressInput,
      });
      assertQuote(quote);
      const address = locateAddress(addressInput, quote);

      const orderId = randomUUID();
      const orderNumber = await this.orders.allocateOrderNumber(
        scope.tenantId,
        tx,
      );
      const trackingToken = randomBytes(32).toString('base64url');
      const response: CreatedOrder = {
        orderId,
        orderNumber,
        status: 'NEW',
        totalCents: cart.subtotalCents + quote.feeCents,
        trackingToken,
        trackingPath: trackingPath(trackingToken),
      };
      await this.orders.insertOrder(
        {
          id: orderId,
          tenantId: scope.tenantId,
          storeId: scope.storeId,
          customerId: customer.id,
          orderNumber,
          fulfillment: input.fulfillment,
          paymentMethodCode: method.code,
          paymentLabel: method.label,
          paymentInstructions: method.instructions,
          customerName: customer.name,
          customerPhone: customer.phone,
          address,
          subtotalCents: cart.subtotalCents,
          deliveryFeeCents: quote.feeCents,
          totalCents: response.totalCents,
          notes: input.notes,
          trackingTokenHash: createHash('sha256')
            .update(trackingToken)
            .digest('hex'),
          idempotencyKey: idempotencyKey,
          createdAt: now,
          updatedAt: now,
        },
        cart.items.map((item) => ({
          id: randomUUID(),
          tenantId: scope.tenantId,
          orderId,
          position: item.itemIndex,
          productId: item.productId,
          productName: item.name,
          sku: item.sku,
          unitPriceCents: item.unitPriceCents,
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
        {
          id: randomUUID(),
          tenantId: scope.tenantId,
          orderId,
          createdAt: now,
        },
        tx,
      );
      await this.events.publish(
        orderEvent({
          id: randomUUID(),
          tenantId: scope.tenantId,
          orderId,
          orderNumber,
          storeId: scope.storeId,
          status: 'NEW',
          fulfillment: input.fulfillment,
          type: ORDER_CREATED_EVENT,
          occurredAt: now,
        }),
        tx,
      );
      if (address !== null) {
        const saved: CustomerAddressRecord = {
          id: randomUUID(),
          tenantId: scope.tenantId,
          customerId: customer.id,
          label: null,
          line: address.line,
          number: address.number,
          complement: address.complement,
          district: address.district,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          latitude: address.latitude,
          longitude: address.longitude,
          createdAt: now,
        };
        await this.customers.insertAddress(saved, tx);
      }
      await this.orders.completeIdempotency(
        scope.tenantId,
        idempotencyKey,
        response,
        tx,
      );
      createdNew = true;
      return response;
      }),
    );

    if (createdNew) {
      observeCounter('orders_created');
    }
    this.logger.log(`Order created ${created.orderId}`, 'CreatePublicOrder');
    return created;
  }

  private async withDeadlockRetry<T>(work: () => Promise<T>): Promise<T> {
    const attempts = 3;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await work();
      } catch (error) {
        if (!isDeadlock(error) || attempt === attempts) {
          throw error;
        }
        this.logger.log(
          `Order creation retried after a database deadlock`,
          'CreatePublicOrder',
        );
      }
    }
    throw new Error('The order could not be created');
  }

  private async resolveCustomer(
    scope: { tenantId: string; storeId: string },
    name: string,
    phone: string,
    tx: TransactionContext,
  ): Promise<CustomerRecord> {
    const existing = await this.customers.lockByPhone(scope, phone, tx);
    const customer = existing ?? (await this.insertCustomer(scope, name, phone, tx));
    if (customer.name === name) {
      return customer;
    }
    const renamed: CustomerRecord = {
      ...customer,
      name,
      updatedAt: new Date(),
    };
    await this.customers.updateName(renamed, tx);
    return renamed;
  }

  private async insertCustomer(
    scope: { tenantId: string; storeId: string },
    name: string,
    phone: string,
    tx: TransactionContext,
  ): Promise<CustomerRecord> {
    const created: CustomerRecord = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      storeId: scope.storeId,
      name,
      phone,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    try {
      await this.customers.insert(created, tx);
      return created;
    } catch (error) {
      if (!isMysqlDuplicate(error)) {
        throw error;
      }
      const raced = await this.customers.lockByPhone(scope, phone, tx);
      if (raced === null) {
        throw error;
      }
      return raced;
    }
  }
}

function locateAddress(
  address: OrderAddressDraft | null,
  quote: DeliveryQuoteResult,
): OrderAddress | null {
  if (address === null) {
    return null;
  }
  if (quote.latitude === null || quote.longitude === null) {
    throw new DomainException(
      'ADDRESS_NOT_FOUND',
      'The address was not found',
      422,
    );
  }
  return {
    ...address,
    latitude: quote.latitude,
    longitude: quote.longitude,
  };
}

function readIdempotencyKey(value: string | undefined): string {
  const key = value?.trim() ?? '';
  if (key.length === 0) {
    throw new DomainException(
      'IDEMPOTENCY_KEY_REQUIRED',
      'The idempotency key is required',
      400,
    );
  }
  if (key.length > 128) {
    throw new DomainException(
      'VALIDATION_ERROR',
      'The request payload is invalid',
      400,
    );
  }
  return key;
}

function hashRequest(input: CreateOrderInput): string {
  return createHash('sha256').update(stableStringify(input)).digest('hex');
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortValue(record[key]);
    }
    return sorted;
  }
  return value;
}

function clip(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 'unknown';
  }
  return trimmed.slice(0, max);
}

function isMysqlDuplicate(error: unknown): boolean {
  return mysqlCode(error) === 'ER_DUP_ENTRY';
}

function isDeadlock(error: unknown): boolean {
  return mysqlCode(error) === 'ER_LOCK_DEADLOCK';
}

function mysqlCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const candidate = error as {
    code?: string;
    driverError?: { code?: string };
  };
  return candidate.driverError?.code ?? candidate.code;
}
