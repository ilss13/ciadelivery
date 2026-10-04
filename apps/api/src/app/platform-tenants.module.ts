import { Module } from '@nestjs/common';
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
  imports: [TenancyCoreModule, StoresModule],
  controllers: [PlatformTenantsController],
  providers: [
    SuperAdminGuard,
    {
      provide: CreateTenant,
      useFactory: (
        tenants: TenantRepository,
        stores: Stores,
        unitOfWork: UnitOfWork,
      ) => new CreateTenant(tenants, stores, unitOfWork),
      inject: [TENANT_REPOSITORY, STORES, UNIT_OF_WORK],
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
