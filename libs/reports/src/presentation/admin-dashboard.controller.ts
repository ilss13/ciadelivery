import { DomainException } from '@ciadelivery/shared';
import { TenantContextInterceptor } from '@ciadelivery/tenancy/guards';
import {
  PermissionsGuard,
  RequestActor,
  RequirePermissions,
} from '@ciadelivery/users';
import { Controller, Get, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminDashboard } from '../application/admin-dashboard';
import { DashboardResponse } from './dashboard.dto';

@ApiTags('admin-dashboard')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@RequirePermissions('orders.read')
@Controller('api/v1/admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboard) {}

  @Get()
  @ApiOkResponse({ type: DashboardResponse })
  snapshot(
    @Req() request: { actor?: RequestActor },
  ): Promise<DashboardResponse> {
    return this.dashboard.execute(actorFrom(request));
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
