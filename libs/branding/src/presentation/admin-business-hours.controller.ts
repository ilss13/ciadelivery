import { DomainException } from '@ciadelivery/shared';
import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { TenantContextInterceptor } from '@ciadelivery/tenancy/guards';
import {
  PermissionsGuard,
  RequestActor,
  RequirePermissions,
} from '@ciadelivery/users';
import {
  GetBusinessHours,
  ReplaceBusinessHours,
} from '../application/business-hours-settings';
import { BusinessDay } from '../domain/business-hours';
import {
  BusinessHoursResponse,
  ReplaceBusinessHoursDto,
} from './business-hours.dto';

@ApiTags('admin-store')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@RequirePermissions('store.configure')
@Controller('api/v1/admin/store/hours')
export class AdminBusinessHoursController {
  constructor(
    private readonly getHours: GetBusinessHours,
    private readonly replaceHours: ReplaceBusinessHours,
  ) {}

  @Get()
  @ApiOkResponse({ type: BusinessHoursResponse })
  async get(
    @Req() request: { actor?: RequestActor },
  ): Promise<BusinessHoursResponse> {
    return { hours: await this.getHours.execute(actorFrom(request)) };
  }

  @Put()
  @ApiOkResponse({ type: BusinessHoursResponse })
  async update(
    @Req() request: { actor?: RequestActor },
    @Body() body: ReplaceBusinessHoursDto,
  ): Promise<{ hours: BusinessDay[] }> {
    return {
      hours: await this.replaceHours.execute(actorFrom(request), body.hours),
    };
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
