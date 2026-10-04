import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResolveTenant } from './application/resolve-tenant';
import {
  TenantRepository,
  TENANT_REPOSITORY,
} from './domain/tenant-repository';
import { UNIT_OF_WORK } from './domain/transaction-context';
import { TenantEntity } from './infrastructure/tenant.entity';
import { TypeOrmTenantRepository } from './infrastructure/typeorm-tenant-repository';
import { TypeOrmUnitOfWork } from './infrastructure/typeorm-unit-of-work';
import { PublicTenantGuard } from './presentation/public-tenant.guard';
import { TenantContextInterceptor } from './presentation/tenant-context.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([TenantEntity])],
  providers: [
    TypeOrmTenantRepository,
    { provide: TENANT_REPOSITORY, useExisting: TypeOrmTenantRepository },
    TypeOrmUnitOfWork,
    { provide: UNIT_OF_WORK, useExisting: TypeOrmUnitOfWork },
    {
      provide: ResolveTenant,
      useFactory: (tenants: TenantRepository) => new ResolveTenant(tenants),
      inject: [TENANT_REPOSITORY],
    },
    PublicTenantGuard,
    TenantContextInterceptor,
  ],
  exports: [
    TENANT_REPOSITORY,
    UNIT_OF_WORK,
    ResolveTenant,
    PublicTenantGuard,
    TenantContextInterceptor,
  ],
})
export class TenancyCoreModule {}
