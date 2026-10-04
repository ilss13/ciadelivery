import { APP_CONFIG, AppConfig, STORAGE, StorageProvider, WarningLog } from '@ciadelivery/shared';
import { Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrentStore, CURRENT_STORE, StoresModule } from '@ciadelivery/stores';
import {
  CreateTenant,
  STORES,
  Stores,
  TENANT_REPOSITORY,
  TenancyCoreModule,
  TenantRepository,
  UNIT_OF_WORK,
  UnitOfWork,
  UpdateTenant,
} from '@ciadelivery/tenancy';
import {
  PASSWORD_HASHER,
  PermissionsGuard,
  UsersModule,
} from '@ciadelivery/users';
import {
  GetBranding,
  SaveBranding,
  UploadBrandingImage,
} from './application/branding-settings';
import {
  GetBusinessHours,
  ReplaceBusinessHours,
} from './application/business-hours-settings';
import { GetPublicStore } from './application/get-public-store';
import { SetCustomDomain } from './application/set-custom-domain';
import { BRANDING, BrandingRepository } from './domain/branding-repository';
import {
  BUSINESS_HOURS,
  BusinessHoursRepository,
} from './domain/business-hours-repository';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher';
import { BrandingConfigEntity } from './infrastructure/branding-config.entity';
import { BusinessHourEntity } from './infrastructure/business-hour.entity';
import { TypeOrmBranding } from './infrastructure/typeorm-branding';
import { TypeOrmBusinessHours } from './infrastructure/typeorm-business-hours';
import { AdminBrandingController } from './presentation/admin-branding.controller';
import { AdminDomainController } from './presentation/admin-domain.controller';
import { AdminBusinessHoursController } from './presentation/admin-business-hours.controller';
import { PublicStoreController } from './presentation/public-store.controller';
import { DemoTenantSeed } from './seed-demo-tenants';

@Module({
  imports: [
    TenancyCoreModule,
    StoresModule,
    UsersModule,
    TypeOrmModule.forFeature([BrandingConfigEntity, BusinessHourEntity]),
  ],
  controllers: [
    PublicStoreController,
    AdminBrandingController,
    AdminBusinessHoursController,
    AdminDomainController,
  ],
  providers: [
    PermissionsGuard,
    TypeOrmBranding,
    { provide: BRANDING, useExisting: TypeOrmBranding },
    TypeOrmBusinessHours,
    { provide: BUSINESS_HOURS, useExisting: TypeOrmBusinessHours },
    Argon2PasswordHasher,
    { provide: PASSWORD_HASHER, useExisting: Argon2PasswordHasher },
    {
      provide: CreateTenant,
      useFactory: (
        tenants: TenantRepository,
        stores: Stores,
        unitOfWork: UnitOfWork,
      ) => new CreateTenant(tenants, stores, unitOfWork),
      inject: [TENANT_REPOSITORY, STORES, UNIT_OF_WORK],
    },
    DemoTenantSeed,
    {
      provide: GetPublicStore,
      useFactory: (
        stores: CurrentStore,
        branding: BrandingRepository,
        hours: BusinessHoursRepository,
        storage: StorageProvider,
      ) => new GetPublicStore(stores, branding, hours, storage),
      inject: [CURRENT_STORE, BRANDING, BUSINESS_HOURS, STORAGE],
    },
    {
      provide: GetBranding,
      useFactory: (
        stores: CurrentStore,
        branding: BrandingRepository,
        storage: StorageProvider,
      ) => new GetBranding(stores, branding, storage),
      inject: [CURRENT_STORE, BRANDING, STORAGE],
    },
    {
      provide: SaveBranding,
      useFactory: (
        stores: CurrentStore,
        branding: BrandingRepository,
        storage: StorageProvider,
      ) => new SaveBranding(stores, branding, storage),
      inject: [CURRENT_STORE, BRANDING, STORAGE],
    },
    {
      provide: UploadBrandingImage,
      useFactory: (
        stores: CurrentStore,
        branding: BrandingRepository,
        storage: StorageProvider,
      ) =>
        new UploadBrandingImage(
          stores,
          branding,
          storage,
          brandingStorageWarnings(),
        ),
      inject: [CURRENT_STORE, BRANDING, STORAGE],
    },
    {
      provide: GetBusinessHours,
      useFactory: (stores: CurrentStore, hours: BusinessHoursRepository) =>
        new GetBusinessHours(stores, hours),
      inject: [CURRENT_STORE, BUSINESS_HOURS],
    },
    {
      provide: ReplaceBusinessHours,
      useFactory: (stores: CurrentStore, hours: BusinessHoursRepository) =>
        new ReplaceBusinessHours(stores, hours),
      inject: [CURRENT_STORE, BUSINESS_HOURS],
    },
    {
      provide: UpdateTenant,
      useFactory: (
        tenants: TenantRepository,
        stores: Stores,
        unitOfWork: UnitOfWork,
      ) => new UpdateTenant(tenants, stores, unitOfWork),
      inject: [TENANT_REPOSITORY, STORES, UNIT_OF_WORK],
    },
    {
      provide: SetCustomDomain,
      useFactory: (
        updateTenant: UpdateTenant,
        tenants: TenantRepository,
        config: AppConfig,
      ) => new SetCustomDomain(updateTenant, tenants, config.platformDomain),
      inject: [UpdateTenant, TENANT_REPOSITORY, APP_CONFIG],
    },
  ],
})
export class BrandingModule {}

function brandingStorageWarnings(): WarningLog {
  const logger = new Logger('BrandingStorage');
  return {
    warn(message: string): void {
      logger.warn(message);
    },
  };
}
