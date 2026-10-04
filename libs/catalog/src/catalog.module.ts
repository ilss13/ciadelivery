import { Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseReady, STORAGE, StorageProvider, WarningLog } from '@ciadelivery/shared';
import { CurrentStore, CURRENT_STORE, StoresModule } from '@ciadelivery/stores';
import {
  TenancyCoreModule,
  UNIT_OF_WORK,
  UnitOfWork,
} from '@ciadelivery/tenancy';
import { PermissionsGuard } from '@ciadelivery/users';
import { AdminCatalog } from './application/admin-catalog';
import { PublicCatalog } from './application/public-catalog';
import { ValidatePublicCart } from './application/validate-cart';
import { CATALOG, CatalogRepository } from './domain/catalog-repository';
import {
  CategoryEntity,
  OptionEntity,
  OptionGroupEntity,
  ProductEntity,
} from './infrastructure/catalog.entities';
import { TypeOrmCatalog } from './infrastructure/typeorm-catalog';
import { AdminCategoriesController } from './presentation/admin-categories.controller';
import { AdminOptionsController } from './presentation/admin-options.controller';
import { AdminProductsController } from './presentation/admin-products.controller';
import {
  PublicCategoriesController,
  PublicProductsController,
} from './presentation/public-catalog.controller';
import { PublicCartController } from './presentation/public-cart.controller';
import { DemoCatalogSeed } from './seed-demo-catalog';

@Module({
  imports: [
    TenancyCoreModule,
    StoresModule,
    TypeOrmModule.forFeature([
      CategoryEntity,
      ProductEntity,
      OptionGroupEntity,
      OptionEntity,
    ]),
  ],
  controllers: [
    AdminCategoriesController,
    AdminProductsController,
    AdminOptionsController,
    PublicCategoriesController,
    PublicProductsController,
    PublicCartController,
  ],
  providers: [
    PermissionsGuard,
    DemoCatalogSeed,
    TypeOrmCatalog,
    { provide: CATALOG, useExisting: TypeOrmCatalog },
    {
      provide: AdminCatalog,
      useFactory: (
        catalog: CatalogRepository,
        stores: CurrentStore,
        unitOfWork: UnitOfWork,
        storage: StorageProvider,
      ) =>
        new AdminCatalog(catalog, stores, unitOfWork, storage, storageWarnings()),
      inject: [CATALOG, CURRENT_STORE, UNIT_OF_WORK, STORAGE],
    },
    {
      provide: PublicCatalog,
      useFactory: (catalog: CatalogRepository, stores: CurrentStore, storage: StorageProvider) =>
        new PublicCatalog(catalog, stores, storage),
      inject: [CATALOG, CURRENT_STORE, STORAGE],
    },
    {
      provide: ValidatePublicCart,
      useFactory: (
        catalog: CatalogRepository,
        stores: CurrentStore,
        database: DatabaseReady,
      ) => new ValidatePublicCart(catalog, stores, database),
      inject: [CATALOG, CURRENT_STORE, DatabaseReady],
    },
  ],
})
export class CatalogModule {}

function storageWarnings(): WarningLog {
  const logger = new Logger('CatalogStorage');
  return {
    warn(message: string): void {
      logger.warn(message);
    },
  };
}
