import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule, ValidatePublicCart } from '@ciadelivery/catalog';
import { CUSTOMERS, CustomerRepository, CustomersModule } from '@ciadelivery/customers';
import { CURRENT_STORE, CurrentStore, StoresModule } from '@ciadelivery/stores';
import {
  SuperAdminGuard,
  TenancyCoreModule,
  UNIT_OF_WORK,
  UnitOfWork,
} from '@ciadelivery/tenancy';
import { PermissionsGuard } from '@ciadelivery/users';
import { AdminOrders } from './application/admin-orders';
import { CreatePublicOrder } from './application/create-public-order';
import { GetPublicCheckout } from './application/get-public-checkout';
import { GetPublicOrder } from './application/get-public-order';
import { RequeueOutbox } from './application/requeue-outbox';
import { ReviewPublicOrder } from './application/review-public-order';
import { TransitionAdminOrder } from './application/transition-admin-order';
import { DELIVERY_QUOTE, DeliveryQuotePort } from './domain/delivery-quote';
import { DOMAIN_EVENTS, DomainEventPublisher } from './domain/domain-event';
import { FlatDeliveryQuote } from './domain/flat-delivery-quote';
import { ORDERS, OrderRepository } from './domain/order-repository';
import { OUTBOX_STORE, OutboxStore } from './domain/outbox';
import {
  IdempotencyRecordEntity,
  OrderEntity,
  OrderItemEntity,
  OrderStatusHistoryEntity,
} from './infrastructure/order.entities';
import { OutboxDomainEventPublisher } from './infrastructure/outbox-domain-event-publisher';
import { OutboxEventEntity } from './infrastructure/outbox.entities';
import { TypeOrmOrders } from './infrastructure/typeorm-orders';
import { TypeOrmOutbox } from './infrastructure/typeorm-outbox';
import { AdminOrdersController } from './presentation/admin-orders.controller';
import { PlatformOutboxController } from './presentation/platform-outbox.controller';
import { PublicCheckoutController } from './presentation/public-checkout.controller';
import { PublicOrdersController } from './presentation/public-orders.controller';

@Module({
  imports: [
    TenancyCoreModule,
    StoresModule,
    CatalogModule,
    CustomersModule,
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      OrderStatusHistoryEntity,
      IdempotencyRecordEntity,
      OutboxEventEntity,
    ]),
  ],
  controllers: [
    PublicOrdersController,
    PublicCheckoutController,
    AdminOrdersController,
    PlatformOutboxController,
  ],
  providers: [
    PermissionsGuard,
    SuperAdminGuard,
    TypeOrmOrders,
    { provide: ORDERS, useExisting: TypeOrmOrders },
    TypeOrmOutbox,
    { provide: OUTBOX_STORE, useExisting: TypeOrmOutbox },
    OutboxDomainEventPublisher,
    { provide: DOMAIN_EVENTS, useExisting: OutboxDomainEventPublisher },
    {
      provide: DELIVERY_QUOTE,
      useFactory: () => new FlatDeliveryQuote(),
    },
    {
      provide: CreatePublicOrder,
      useFactory: (
        customers: CustomerRepository,
        stores: CurrentStore,
        carts: ValidatePublicCart,
        quotes: DeliveryQuotePort,
        orders: OrderRepository,
        unitOfWork: UnitOfWork,
        events: DomainEventPublisher,
      ) =>
        new CreatePublicOrder(
          customers,
          stores,
          carts,
          quotes,
          orders,
          unitOfWork,
          events,
        ),
      inject: [
        CUSTOMERS,
        CURRENT_STORE,
        ValidatePublicCart,
        DELIVERY_QUOTE,
        ORDERS,
        UNIT_OF_WORK,
        DOMAIN_EVENTS,
      ],
    },
    {
      provide: GetPublicOrder,
      useFactory: (orders: OrderRepository) => new GetPublicOrder(orders),
      inject: [ORDERS],
    },
    {
      provide: ReviewPublicOrder,
      useFactory: (
        customers: CustomerRepository,
        stores: CurrentStore,
        carts: ValidatePublicCart,
        quotes: DeliveryQuotePort,
      ) => new ReviewPublicOrder(customers, stores, carts, quotes),
      inject: [CUSTOMERS, CURRENT_STORE, ValidatePublicCart, DELIVERY_QUOTE],
    },
    {
      provide: GetPublicCheckout,
      useFactory: (customers: CustomerRepository, stores: CurrentStore) =>
        new GetPublicCheckout(customers, stores),
      inject: [CUSTOMERS, CURRENT_STORE],
    },
    {
      provide: AdminOrders,
      useFactory: (orders: OrderRepository, stores: CurrentStore) =>
        new AdminOrders(orders, stores),
      inject: [ORDERS, CURRENT_STORE],
    },
    {
      provide: TransitionAdminOrder,
      useFactory: (
        orders: OrderRepository,
        stores: CurrentStore,
        events: DomainEventPublisher,
        unitOfWork: UnitOfWork,
      ) => new TransitionAdminOrder(orders, stores, events, unitOfWork),
      inject: [ORDERS, CURRENT_STORE, DOMAIN_EVENTS, UNIT_OF_WORK],
    },
    {
      provide: RequeueOutbox,
      useFactory: (outbox: OutboxStore) => new RequeueOutbox(outbox),
      inject: [OUTBOX_STORE],
    },
  ],
  exports: [DOMAIN_EVENTS],
})
export class OrdersModule {}
