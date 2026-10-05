import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GEOCODING, GeocodingProvider } from '@ciadelivery/shared';
import { TenancyCoreModule } from '@ciadelivery/tenancy/core';
import { STORES } from '@ciadelivery/tenancy/domain';
import { PermissionsGuard } from '@ciadelivery/users';
import {
  GetStoreSettings,
  UpdateStoreSettings,
} from './application/store-settings';
import { CURRENT_STORE, CurrentStore } from './domain/current-store';
import { StoreEntity } from './infrastructure/store.entity';
import { TypeOrmStores } from './infrastructure/typeorm-stores';
import { AdminStoreController } from './presentation/admin-store.controller';

@Module({
  imports: [TenancyCoreModule, TypeOrmModule.forFeature([StoreEntity])],
  controllers: [AdminStoreController],
  providers: [
    PermissionsGuard,
    TypeOrmStores,
    { provide: STORES, useExisting: TypeOrmStores },
    { provide: CURRENT_STORE, useExisting: TypeOrmStores },
    {
      provide: GetStoreSettings,
      useFactory: (stores: CurrentStore) => new GetStoreSettings(stores),
      inject: [CURRENT_STORE],
    },
    {
      provide: UpdateStoreSettings,
      useFactory: (stores: CurrentStore, geocoding: GeocodingProvider) =>
        new UpdateStoreSettings(stores, geocoding),
      inject: [CURRENT_STORE, GEOCODING],
    },
  ],
  exports: [STORES, CURRENT_STORE],
})
export class StoresModule {}
