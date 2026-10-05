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
import { IdentifyCustomer } from './application/identify-customer';
import { PaymentMethods } from './application/payment-methods';
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
import { TypeOrmCustomers } from './infrastructure/typeorm-customers';
import { AdminCustomersController } from './presentation/admin-customers.controller';
import { AdminPaymentMethodsController } from './presentation/admin-payment-methods.controller';
import { PublicCustomersController } from './presentation/public-customers.controller';

@Module({
  imports: [
    TenancyCoreModule,
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
      provide: PaymentMethods,
      useFactory: (
        customers: CustomerRepository,
        stores: CurrentStore,
        unitOfWork: UnitOfWork,
      ) => new PaymentMethods(customers, stores, unitOfWork),
      inject: [CUSTOMERS, CURRENT_STORE, UNIT_OF_WORK],
    },
  ],
})
export class CustomersModule {}
