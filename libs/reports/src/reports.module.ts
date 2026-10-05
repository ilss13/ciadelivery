import { Module } from '@nestjs/common';
import { CurrentStore, StoresModule, CURRENT_STORE } from '@ciadelivery/stores';
import { TenancyCoreModule } from '@ciadelivery/tenancy';
import { PermissionsGuard, UsersModule } from '@ciadelivery/users';
import { AdminDashboard } from './application/admin-dashboard';
import { AdminReports } from './application/admin-reports';
import { REPORTS, ReportsReader } from './domain/reports';
import { TypeOrmReports } from './infrastructure/typeorm-reports';
import { AdminDashboardController } from './presentation/admin-dashboard.controller';
import { AdminReportsController } from './presentation/admin-reports.controller';

@Module({
  imports: [TenancyCoreModule, UsersModule, StoresModule],
  controllers: [AdminReportsController, AdminDashboardController],
  providers: [
    PermissionsGuard,
    TypeOrmReports,
    { provide: REPORTS, useExisting: TypeOrmReports },
    {
      provide: AdminReports,
      useFactory: (reports: ReportsReader, stores: CurrentStore) =>
        new AdminReports(reports, stores),
      inject: [REPORTS, CURRENT_STORE],
    },
    {
      provide: AdminDashboard,
      useFactory: (reports: ReportsReader, stores: CurrentStore) =>
        new AdminDashboard(reports, stores),
      inject: [REPORTS, CURRENT_STORE],
    },
  ],
})
export class ReportsModule {}
