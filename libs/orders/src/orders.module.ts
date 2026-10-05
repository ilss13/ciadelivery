import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule, ValidatePublicCart } from '@ciadelivery/catalog';
import { CUSTOMERS, CustomerRepository, CustomersModule } from '@ciadelivery/customers';
import { CURRENT_STORE, CurrentStore, StoresModule } from '@ciadelivery/stores';
import {
  TenancyCoreModule,
  UNIT_OF_WORK,
  UnitOfWork,
} from '@ciadelivery/tenancy';
import { PermissionsGuard } from '@ciadelivery/users';
import { AdminOrders } from './application/admin-orders';
import { CreatePublicOrder } from './application/create-public-order';
import { GetPublicCheckout } from './application/get-public-checkout';
import { GetPublicOrder } from './application/get-public-order';
import { ReviewPublicOrder } from './application/review-public-order';
import { DELIVERY_QUOTE, DeliveryQuotePort } from './domain/delivery-quote';
import { FlatDeliveryQuote } from './domain/flat-delivery-quote';
import { ORDERS, OrderRepository } from './domain/order-repository';
import {
  IdempotencyRecordEntity,
  OrderEntity,
  OrderItemEntity,
  OrderStatusHistoryEntity,
} from './infrastructure/order.entities';
import { TypeOrmOrders } from './infrastructure/typeorm-orders';
import { AdminOrdersController } from './presentation/admin-orders.controller';
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
    ]),
  ],
  controllers: [
    PublicOrdersController,
    PublicCheckoutController,
    AdminOrdersController,
  ],
  providers: [
    PermissionsGuard,
    TypeOrmOrders,
    { provide: ORDERS, useExisting: TypeOrmOrders },
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
      ) =>
        new CreatePublicOrder(
          customers,
          stores,
          carts,
          quotes,
          orders,
          unitOfWork,
        ),
      inject: [
        CUSTOMERS,
        CURRENT_STORE,
        ValidatePublicCart,
        DELIVERY_QUOTE,
        ORDERS,
        UNIT_OF_WORK,
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
  ],
})
export class OrdersModule {}
