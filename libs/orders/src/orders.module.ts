import { AUDIT_LOGS, AuditLogs, AuditModule } from '@ciadelivery/audit';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CatalogModule,
  TestOrderCatalog,
  ValidatePublicCart,
} from '@ciadelivery/catalog';
import {
  CUSTOMERS,
  CustomerRepository,
  CustomersModule,
} from '@ciadelivery/customers';
import {
  CHECKLIST,
  Checklist,
  OnboardingModule,
} from '@ciadelivery/onboarding';
import {
  ASSIGNMENTS,
  Assignments,
  COURIERS,
  Couriers,
  DELIVERY_POLICIES,
  DeliveryModule,
  DeliveryPolicies,
} from '@ciadelivery/delivery';
import { GEOCODING, GeocodingProvider } from '@ciadelivery/shared';
import { CURRENT_STORE, CurrentStore, StoresModule } from '@ciadelivery/stores';
import {
  SuperAdminGuard,
  TenancyCoreModule,
  UNIT_OF_WORK,
  UnitOfWork,
} from '@ciadelivery/tenancy';
import { PermissionsGuard } from '@ciadelivery/users';
import { AdminOrders } from './application/admin-orders';
import { AdvanceDelivery } from './application/advance-delivery';
import { AssignCourier } from './application/assign-courier';
import { CourierOrders } from './application/courier-orders';
import { CreatePublicOrder } from './application/create-public-order';
import { GetPublicCheckout } from './application/get-public-checkout';
import { GetPublicOrder } from './application/get-public-order';
import { PlaceTestOrder } from './application/place-test-order';
import { RequeueOutbox } from './application/requeue-outbox';
import { ReviewPublicOrder } from './application/review-public-order';
import { TransitionAdminOrder } from './application/transition-admin-order';
import { ConfiguredDeliveryQuote } from './domain/configured-delivery-quote';
import { DELIVERY_QUOTE, DeliveryQuotePort } from './domain/delivery-quote';
import {
  COURIER_ORDERS,
  CourierOrderReader,
} from './domain/courier-order-reader';
import { DOMAIN_EVENTS, DomainEventPublisher } from './domain/domain-event';
import { ORDERS, OrderRepository } from './domain/order-repository';
import { OUTBOX_STORE, OutboxStore } from './domain/outbox';
import {
  PUBLIC_ORDER_RATE_LIMIT,
  PublicOrderRateLimit,
} from './domain/public-order-rate-limit';
import {
  IdempotencyRecordEntity,
  OrderEntity,
  OrderItemEntity,
  OrderStatusHistoryEntity,
} from './infrastructure/order.entities';
import { OutboxDomainEventPublisher } from './infrastructure/outbox-domain-event-publisher';
import { OutboxEventEntity } from './infrastructure/outbox.entities';
import { TypeOrmCourierOrders } from './infrastructure/typeorm-courier-orders';
import { TypeOrmOrders } from './infrastructure/typeorm-orders';
import { TypeOrmOutbox } from './infrastructure/typeorm-outbox';
import { RedisPublicOrderRateLimit } from './infrastructure/redis-public-order-rate-limit';
import { AdminOrdersController } from './presentation/admin-orders.controller';
import { CourierOrdersController } from './presentation/courier-orders.controller';
import { PlatformOutboxController } from './presentation/platform-outbox.controller';
import { PublicCheckoutController } from './presentation/public-checkout.controller';
import { PublicOrdersController } from './presentation/public-orders.controller';

@Module({
  imports: [
    TenancyCoreModule,
    AuditModule,
    OnboardingModule,
    StoresModule,
    CatalogModule,
    CustomersModule,
    DeliveryModule,
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
    CourierOrdersController,
    PlatformOutboxController,
  ],
  providers: [
    PermissionsGuard,
    SuperAdminGuard,
    TypeOrmOrders,
    { provide: ORDERS, useExisting: TypeOrmOrders },
    TypeOrmCourierOrders,
    { provide: COURIER_ORDERS, useExisting: TypeOrmCourierOrders },
    TypeOrmOutbox,
    { provide: OUTBOX_STORE, useExisting: TypeOrmOutbox },
    RedisPublicOrderRateLimit,
    {
      provide: PUBLIC_ORDER_RATE_LIMIT,
      useExisting: RedisPublicOrderRateLimit,
    },
    OutboxDomainEventPublisher,
    { provide: DOMAIN_EVENTS, useExisting: OutboxDomainEventPublisher },
    {
      provide: DELIVERY_QUOTE,
      useFactory: (geocoding: GeocodingProvider) =>
        new ConfiguredDeliveryQuote(geocoding),
      inject: [GEOCODING],
    },
    {
      provide: PlaceTestOrder,
      useFactory: (
        customers: CustomerRepository,
        stores: CurrentStore,
        catalog: TestOrderCatalog,
        orders: OrderRepository,
        unitOfWork: UnitOfWork,
        events: DomainEventPublisher,
        checklist: Checklist,
      ) =>
        new PlaceTestOrder(
          customers,
          stores,
          catalog,
          orders,
          unitOfWork,
          events,
          checklist,
        ),
      inject: [
        CUSTOMERS,
        CURRENT_STORE,
        TestOrderCatalog,
        ORDERS,
        UNIT_OF_WORK,
        DOMAIN_EVENTS,
        CHECKLIST,
      ],
    },
    {
      provide: CreatePublicOrder,
      useFactory: (
        customers: CustomerRepository,
        stores: CurrentStore,
        policies: DeliveryPolicies,
        carts: ValidatePublicCart,
        quotes: DeliveryQuotePort,
        orders: OrderRepository,
        unitOfWork: UnitOfWork,
        events: DomainEventPublisher,
        rateLimit: PublicOrderRateLimit,
      ) =>
        new CreatePublicOrder(
          customers,
          stores,
          policies,
          carts,
          quotes,
          orders,
          unitOfWork,
          events,
          rateLimit,
        ),
      inject: [
        CUSTOMERS,
        CURRENT_STORE,
        DELIVERY_POLICIES,
        ValidatePublicCart,
        DELIVERY_QUOTE,
        ORDERS,
        UNIT_OF_WORK,
        DOMAIN_EVENTS,
        PUBLIC_ORDER_RATE_LIMIT,
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
        policies: DeliveryPolicies,
        carts: ValidatePublicCart,
        quotes: DeliveryQuotePort,
        rateLimit: PublicOrderRateLimit,
      ) =>
        new ReviewPublicOrder(
          customers,
          stores,
          policies,
          carts,
          quotes,
          rateLimit,
        ),
      inject: [
        CUSTOMERS,
        CURRENT_STORE,
        DELIVERY_POLICIES,
        ValidatePublicCart,
        DELIVERY_QUOTE,
        PUBLIC_ORDER_RATE_LIMIT,
      ],
    },
    {
      provide: GetPublicCheckout,
      useFactory: (
        customers: CustomerRepository,
        stores: CurrentStore,
        policies: DeliveryPolicies,
      ) => new GetPublicCheckout(customers, stores, policies),
      inject: [CUSTOMERS, CURRENT_STORE, DELIVERY_POLICIES],
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
        audit: AuditLogs,
      ) => new TransitionAdminOrder(orders, stores, events, unitOfWork, audit),
      inject: [ORDERS, CURRENT_STORE, DOMAIN_EVENTS, UNIT_OF_WORK, AUDIT_LOGS],
    },
    {
      provide: AssignCourier,
      useFactory: (
        orders: OrderRepository,
        couriers: Couriers,
        assignments: Assignments,
        stores: CurrentStore,
        events: DomainEventPublisher,
        unitOfWork: UnitOfWork,
        audit: AuditLogs,
      ) =>
        new AssignCourier(
          orders,
          couriers,
          assignments,
          stores,
          events,
          unitOfWork,
          audit,
        ),
      inject: [
        ORDERS,
        COURIERS,
        ASSIGNMENTS,
        CURRENT_STORE,
        DOMAIN_EVENTS,
        UNIT_OF_WORK,
        AUDIT_LOGS,
      ],
    },
    {
      provide: AdvanceDelivery,
      useFactory: (
        orders: OrderRepository,
        assignments: Assignments,
        stores: CurrentStore,
        events: DomainEventPublisher,
        unitOfWork: UnitOfWork,
        audit: AuditLogs,
      ) =>
        new AdvanceDelivery(
          orders,
          assignments,
          stores,
          events,
          unitOfWork,
          audit,
        ),
      inject: [
        ORDERS,
        ASSIGNMENTS,
        CURRENT_STORE,
        DOMAIN_EVENTS,
        UNIT_OF_WORK,
        AUDIT_LOGS,
      ],
    },
    {
      provide: CourierOrders,
      useFactory: (
        orders: CourierOrderReader,
        advance: AdvanceDelivery,
        stores: CurrentStore,
      ) => new CourierOrders(orders, advance, stores),
      inject: [COURIER_ORDERS, AdvanceDelivery, CURRENT_STORE],
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
