import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@ciadelivery/auth';
import { GEOCODING, GeocodingProvider } from '@ciadelivery/shared';
import { CURRENT_STORE, CurrentStore, StoresModule } from '@ciadelivery/stores';
import {
  PASSWORD_HASHER,
  PasswordHasher,
  PermissionsGuard,
  USERS,
  Users,
  UsersModule,
} from '@ciadelivery/users';
import { TenancyCoreModule, UNIT_OF_WORK, UnitOfWork } from '@ciadelivery/tenancy';
import { AdminCouriers } from './application/admin-couriers';
import { AdminDelivery } from './application/admin-delivery';
import { QuotePublicDelivery } from './application/quote-public-delivery';
import { ASSIGNMENTS, Assignments } from './domain/assignments.port';
import { COURIERS, Couriers } from './domain/couriers.port';
import { DELIVERY_POLICIES, DeliveryPolicies } from './domain/delivery-policy';
import {
  CourierEntity,
  DeliveryAssignmentEntity,
} from './infrastructure/courier.entities';
import {
  DeliveryConfigEntity,
  DeliveryZoneEntity,
} from './infrastructure/delivery.entities';
import { TypeOrmAssignments } from './infrastructure/typeorm-assignments';
import { TypeOrmCouriers } from './infrastructure/typeorm-couriers';
import { TypeOrmDeliveryPolicies } from './infrastructure/typeorm-delivery-policies';
import { AdminCouriersController } from './presentation/admin-couriers.controller';
import { AdminDeliveryController } from './presentation/admin-delivery.controller';
import { PublicDeliveryController } from './presentation/public-delivery.controller';
import { DemoCourierSeed } from './seed-demo-courier';

@Module({
  imports: [
    TenancyCoreModule,
    StoresModule,
    UsersModule,
    AuthModule,
    TypeOrmModule.forFeature([
      DeliveryConfigEntity,
      DeliveryZoneEntity,
      CourierEntity,
      DeliveryAssignmentEntity,
    ]),
  ],
  controllers: [
    AdminDeliveryController,
    PublicDeliveryController,
    AdminCouriersController,
  ],
  providers: [
    PermissionsGuard,
    DemoCourierSeed,
    TypeOrmDeliveryPolicies,
    { provide: DELIVERY_POLICIES, useExisting: TypeOrmDeliveryPolicies },
    {
      provide: AdminDelivery,
      useFactory: (
        policies: DeliveryPolicies,
        stores: CurrentStore,
        geocoding: GeocodingProvider,
      ) => new AdminDelivery(policies, stores, geocoding),
      inject: [DELIVERY_POLICIES, CURRENT_STORE, GEOCODING],
    },
    {
      provide: QuotePublicDelivery,
      useFactory: (
        policies: DeliveryPolicies,
        stores: CurrentStore,
        geocoding: GeocodingProvider,
      ) => new QuotePublicDelivery(policies, stores, geocoding),
      inject: [DELIVERY_POLICIES, CURRENT_STORE, GEOCODING],
    },
    TypeOrmCouriers,
    { provide: COURIERS, useExisting: TypeOrmCouriers },
    TypeOrmAssignments,
    { provide: ASSIGNMENTS, useExisting: TypeOrmAssignments },
    {
      provide: AdminCouriers,
      useFactory: (
        couriers: Couriers,
        users: Users,
        hasher: PasswordHasher,
        stores: CurrentStore,
        unitOfWork: UnitOfWork,
      ) => new AdminCouriers(couriers, users, hasher, stores, unitOfWork),
      inject: [COURIERS, USERS, PASSWORD_HASHER, CURRENT_STORE, UNIT_OF_WORK],
    },
  ],
  exports: [DELIVERY_POLICIES, COURIERS, ASSIGNMENTS],
})
export class DeliveryModule {}
