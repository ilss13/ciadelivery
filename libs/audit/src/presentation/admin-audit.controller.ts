import { DomainException } from '@ciadelivery/shared';
import { TenantContextInterceptor } from '@ciadelivery/tenancy/guards';
import {
  PermissionsGuard,
  RequestActor,
  RequirePermissions,
} from '@ciadelivery/users';
import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ListAuditLogs } from '../application/list-audit-logs';
import { AuditPageResponse, ListAuditLogsQuery } from './audit.dto';

@ApiTags('admin-audit')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@RequirePermissions('audit.read')
@Controller('api/v1/admin/audit-logs')
export class AdminAuditController {
  constructor(private readonly logs: ListAuditLogs) {}

  @Get()
  @ApiOkResponse({ type: AuditPageResponse })
  list(
    @Req() request: { actor?: RequestActor },
    @Query() query: ListAuditLogsQuery,
  ): Promise<AuditPageResponse> {
    return this.logs.execute(actorFrom(request), {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      ...(query.action === undefined ? {} : { action: query.action }),
      ...(query.entityType === undefined ? {} : { entityType: query.entityType }),
      ...(query.from === undefined ? {} : { from: query.from }),
      ...(query.to === undefined ? {} : { to: query.to }),
    });
  }
}

function actorFrom(request: { actor?: RequestActor }): RequestActor {
  if (request.actor === undefined) {
    throw new DomainException(
      'UNAUTHENTICATED',
      'Authentication is required',
      401,
    );
  }
  return request.actor;
}
