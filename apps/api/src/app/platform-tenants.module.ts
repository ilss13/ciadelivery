import { Module } from '@nestjs/common';
import { CHECKLIST, Checklist, OnboardingModule } from '@ciadelivery/onboarding';
import { StoresModule } from '@ciadelivery/stores';
import {
  CreateTenant,
  GetTenant,
  ListTenants,
  PlatformTenantsController,
  SuperAdminGuard,
  STORES,
  TENANT_REPOSITORY,
  TenancyCoreModule,
  UNIT_OF_WORK,
  UpdateTenant,
  type Stores,
  type TenantRepository,
  type UnitOfWork,
} from '@ciadelivery/tenancy';

@Module({
  imports: [TenancyCoreModule, StoresModule, OnboardingModule],
  controllers: [PlatformTenantsController],
  providers: [
    SuperAdminGuard,
    {
      provide: CreateTenant,
      useFactory: (
        tenants: TenantRepository,
        stores: Stores,
        unitOfWork: UnitOfWork,
        checklist: Checklist,
      ) => new CreateTenant(tenants, stores, unitOfWork, checklist),
      inject: [TENANT_REPOSITORY, STORES, UNIT_OF_WORK, CHECKLIST],
    },
    {
      provide: UpdateTenant,
      useFactory: (
        tenants: TenantRepository,
        stores: Stores,
        unitOfWork: UnitOfWork,
        checklist: Checklist,
      ) => new UpdateTenant(tenants, stores, unitOfWork, checklist),
      inject: [TENANT_REPOSITORY, STORES, UNIT_OF_WORK, CHECKLIST],
    },
    {
      provide: GetTenant,
      useFactory: (tenants: TenantRepository, stores: Stores) =>
        new GetTenant(tenants, stores),
      inject: [TENANT_REPOSITORY, STORES],
    },
    {
      provide: ListTenants,
      useFactory: (tenants: TenantRepository, stores: Stores) =>
        new ListTenants(tenants, stores),
      inject: [TENANT_REPOSITORY, STORES],
    },
  ],
})
export class PlatformTenantsModule {}
