import { AUDIT_LOGS, AuditLogs, AuditModule } from '@ciadelivery/audit';
import { APP_CONFIG, AppConfig } from '@ciadelivery/shared';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrentStore, CURRENT_STORE, StoresModule } from '@ciadelivery/stores';
import {
  TenancyCoreModule,
  UNIT_OF_WORK,
  UnitOfWork,
} from '@ciadelivery/tenancy';
import { PermissionsGuard } from '@ciadelivery/users';
import { AdminCustomers } from './application/admin-customers';
import { CustomerPrivacy } from './application/customer-privacy';
import { IdentifyCustomer } from './application/identify-customer';
import { PaymentMethods } from './application/payment-methods';
import { CUSTOMER_ORDERS, CustomerOrders } from './domain/customer-orders';
import { CUSTOMERS, CustomerRepository } from './domain/customer-repository';
import {
  IDENTIFY_RATE_LIMIT,
  IdentifyRateLimit,
} from './domain/identify-rate-limit';
import {
  CustomerAddressEntity,
  CustomerConsentEntity,
  CustomerEntity,
  PaymentMethodEntity,
} from './infrastructure/customer.entities';
import { RedisIdentifyRateLimit } from './infrastructure/redis-identify-rate-limit';
import { TypeOrmCustomerOrders } from './infrastructure/typeorm-customer-orders';
import { TypeOrmCustomers } from './infrastructure/typeorm-customers';
import { AdminCustomersController } from './presentation/admin-customers.controller';
import { AdminPaymentMethodsController } from './presentation/admin-payment-methods.controller';
import { PublicCustomersController } from './presentation/public-customers.controller';

@Module({
  imports: [
    TenancyCoreModule,
    AuditModule,
    StoresModule,
    TypeOrmModule.forFeature([
      CustomerEntity,
      CustomerAddressEntity,
      CustomerConsentEntity,
      PaymentMethodEntity,
    ]),
  ],
  controllers: [
    PublicCustomersController,
    AdminCustomersController,
    AdminPaymentMethodsController,
  ],
  exports: [CUSTOMERS],
  providers: [
    PermissionsGuard,
    TypeOrmCustomers,
    { provide: CUSTOMERS, useExisting: TypeOrmCustomers },
    TypeOrmCustomerOrders,
    { provide: CUSTOMER_ORDERS, useExisting: TypeOrmCustomerOrders },
    RedisIdentifyRateLimit,
    { provide: IDENTIFY_RATE_LIMIT, useExisting: RedisIdentifyRateLimit },
    {
      provide: IdentifyCustomer,
      useFactory: (
        customers: CustomerRepository,
        stores: CurrentStore,
        rateLimit: IdentifyRateLimit,
      ) => new IdentifyCustomer(customers, stores, rateLimit),
      inject: [CUSTOMERS, CURRENT_STORE, IDENTIFY_RATE_LIMIT],
    },
    {
      provide: AdminCustomers,
      useFactory: (customers: CustomerRepository, stores: CurrentStore) =>
        new AdminCustomers(customers, stores),
      inject: [CUSTOMERS, CURRENT_STORE],
    },
    {
      provide: CustomerPrivacy,
      useFactory: (
        customers: CustomerRepository,
        orders: CustomerOrders,
        stores: CurrentStore,
        unitOfWork: UnitOfWork,
        audit: AuditLogs,
        config: AppConfig,
      ) =>
        new CustomerPrivacy(
          customers,
          orders,
          stores,
          unitOfWork,
          audit,
          config.credentialsEncryptionKey,
        ),
      inject: [
        CUSTOMERS,
        CUSTOMER_ORDERS,
        CURRENT_STORE,
        UNIT_OF_WORK,
        AUDIT_LOGS,
        APP_CONFIG,
      ],
    },
    {
      provide: PaymentMethods,
      useFactory: (
        customers: CustomerRepository,
        stores: CurrentStore,
        unitOfWork: UnitOfWork,
        audit: AuditLogs,
      ) => new PaymentMethods(customers, stores, unitOfWork, audit),
      inject: [CUSTOMERS, CURRENT_STORE, UNIT_OF_WORK, AUDIT_LOGS],
    },
  ],
})
export class CustomersModule {}
