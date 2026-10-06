import { createHash, randomUUID } from 'node:crypto';
import { TestOrderCatalog, validateCart } from '@ciadelivery/catalog';
import {
  CustomerRecord,
  CustomerRepository,
  requireActorStore,
} from '@ciadelivery/customers';
import { DomainException } from '@ciadelivery/shared';
import { CurrentStore } from '@ciadelivery/stores';
import { TransactionContext, UnitOfWork } from '@ciadelivery/tenancy/domain';
import { RequestActor } from '@ciadelivery/users';
import { DomainEventPublisher } from '../domain/domain-event';
import { AdminOrderSummary } from '../domain/order';
import { ORDER_CREATED_EVENT } from '../domain/order-command';
import { OrderRepository } from '../domain/order-repository';
import { orderEvent } from './order-events';

const TEST_PHONE = '5500000000000';
const TEST_CUSTOMER = 'Pedido de teste';
const TEST_NOTES = 'TEST_ORDER';

type StepMarker = {
  markDone(
    input: { tenantId: string; code: string; actorId: string | null },
    tx?: TransactionContext,
  ): Promise<void>;
};

export class PlaceTestOrder {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly stores: CurrentStore,
    private readonly catalog: TestOrderCatalog,
    private readonly orders: OrderRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly events: DomainEventPublisher,
    private readonly steps: StepMarker,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(actor: RequestActor): Promise<AdminOrderSummary> {
    const store = await requireActorStore(actor, this.stores);
    const product = await this.catalog.firstActiveProduct(actor);
    if (product === null) {
      throw noTestProduct();
    }
    const optionIds = product.groups.flatMap((group) =>
      group.options
        .filter((option) => option.available)
        .slice(0, group.minSelect)
        .map((option) => option.id),
    );
    const cart = validateCart({
      items: [{ productId: product.id, quantity: 1, optionIds, notes: null }],
      products: [product],
      minimumOrderCents: 0,
      storeOpen: true,
    });
    if (!cart.valid || cart.items[0] === undefined) {
      throw noTestProduct();
    }
    const item = cart.items[0];
    const instant = this.now();
    const period = localDayBounds(instant, store.timezone);
    const scope = { tenantId: store.tenantId, storeId: store.id };

    return this.unitOfWork.run(async (tx) => {
      const existing = await this.orders.findTodayTestOrder(
        scope.tenantId,
        scope.storeId,
        period.start,
        period.end,
        tx,
      );
      if (existing !== null) {
        await this.markDone(actor, scope.tenantId, tx);
        return existing;
      }
      const customer = await this.resolveCustomer(scope, tx);
      const method = await this.customers.findPaymentMethod(scope, 'CASH', tx);
      if (method === null || !method.enabled) {
        throw new DomainException(
          'PAYMENT_METHOD_DISABLED',
          'The cash payment method is disabled',
          422,
        );
      }
      const orderId = randomUUID();
      const orderNumber = await this.orders.allocateOrderNumber(scope.tenantId, tx);
      await this.orders.insertOrder(
        {
          id: orderId,
          tenantId: scope.tenantId,
          storeId: scope.storeId,
          customerId: customer.id,
          orderNumber,
          source: 'TEST',
          fulfillment: 'PICKUP',
          paymentMethodCode: method.code,
          paymentLabel: method.label,
          paymentInstructions: method.instructions,
          customerName: customer.name,
          customerPhone: customer.phone,
          address: null,
          subtotalCents: cart.subtotalCents,
          deliveryFeeCents: 0,
          totalCents: cart.subtotalCents,
          notes: TEST_NOTES,
          trackingTokenHash: createHash('sha256')
            .update(randomUUID())
            .digest('hex'),
          idempotencyKey: `test:${dayKey(instant, store.timezone)}:${randomUUID()}`,
          createdAt: instant,
          updatedAt: instant,
        },
        [
          {
            id: randomUUID(),
            tenantId: scope.tenantId,
            orderId,
            position: 0,
            productId: item.productId,
            productName: item.name,
            sku: item.sku,
            unitPriceCents: item.unitPriceCents,
            quantity: 1,
            notes: null,
            options: item.options.map((option) => ({
              optionId: option.id,
              groupName: option.groupName,
              name: option.name,
              priceCents: option.priceCents,
            })),
            subtotalCents: item.subtotalCents,
          },
        ],
        {
          id: randomUUID(),
          tenantId: scope.tenantId,
          orderId,
          createdAt: instant,
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
          fulfillment: 'PICKUP',
          type: ORDER_CREATED_EVENT,
          occurredAt: instant,
        }),
        tx,
      );
      await this.markDone(actor, scope.tenantId, tx);
      return {
        id: orderId,
        orderNumber,
        createdAt: instant,
        totalCents: cart.subtotalCents,
        status: 'NEW',
        fulfillment: 'PICKUP',
        customerName: customer.name,
        source: 'TEST',
        notes: TEST_NOTES,
      };
    });
  }

  private async resolveCustomer(
    scope: { tenantId: string; storeId: string },
    tx: TransactionContext,
  ): Promise<CustomerRecord> {
    const existing = await this.customers.lockByPhone(scope, TEST_PHONE, tx);
    if (existing !== null) {
      if (existing.name !== TEST_CUSTOMER) {
        const renamed = { ...existing, name: TEST_CUSTOMER, updatedAt: this.now() };
        await this.customers.updateName(renamed, tx);
        return renamed;
      }
      return existing;
    }
    const created: CustomerRecord = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      storeId: scope.storeId,
      name: TEST_CUSTOMER,
      phone: TEST_PHONE,
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    await this.customers.insert(created, tx);
    return created;
  }

  private markDone(
    actor: RequestActor,
    tenantId: string,
    tx: TransactionContext,
  ): Promise<void> {
    return this.steps.markDone(
      { tenantId, code: 'place_test_order', actorId: actor.userId },
      tx,
    );
  }
}

function noTestProduct(): DomainException {
  return new DomainException(
    'NO_ACTIVE_PRODUCT',
    'No active product can be used for a test order',
    422,
  );
}

function dayKey(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function localDayBounds(now: Date, timeZone: string): { start: Date; end: Date } {
  const [year, month, day] = dayKey(now, timeZone).split('-').map(Number);
  return {
    start: zonedMidnight(year ?? 0, month ?? 0, day ?? 0, timeZone),
    end: zonedMidnight(year ?? 0, month ?? 0, (day ?? 0) + 1, timeZone),
  };
}

function zonedMidnight(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day));
  const corrected = new Date(guess.getTime() - zoneOffsetMs(guess, timeZone));
  return new Date(guess.getTime() - zoneOffsetMs(corrected, timeZone));
}

function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const hour = read('hour') === 24 ? 0 : read('hour');
  return (
    Date.UTC(
      read('year'),
      read('month') - 1,
      read('day'),
      hour,
      read('minute'),
      read('second'),
    ) - instant.getTime()
  );
}
