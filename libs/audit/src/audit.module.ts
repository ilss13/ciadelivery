import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenancyCoreModule } from '@ciadelivery/tenancy';
import { PermissionsGuard, UsersModule } from '@ciadelivery/users';
import { ListAuditLogs } from './application/list-audit-logs';
import { AUDIT_LOGS, AuditLogs } from './domain/audit-log';
import { AuditLogEntity } from './infrastructure/audit-log.entity';
import { TypeOrmAuditLogs } from './infrastructure/typeorm-audit-logs';
import { AdminAuditController } from './presentation/admin-audit.controller';
import { AuditRequestInterceptor } from './presentation/audit-request.interceptor';

@Module({
  imports: [
    TenancyCoreModule,
    UsersModule,
    TypeOrmModule.forFeature([AuditLogEntity]),
  ],
  controllers: [AdminAuditController],
  providers: [
    PermissionsGuard,
    TypeOrmAuditLogs,
    { provide: AUDIT_LOGS, useExisting: TypeOrmAuditLogs },
    AuditRequestInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: AuditRequestInterceptor },
    {
      provide: ListAuditLogs,
      useFactory: (logs: AuditLogs) => new ListAuditLogs(logs),
      inject: [AUDIT_LOGS],
    },
  ],
  exports: [AUDIT_LOGS],
})
export class AuditModule {}
