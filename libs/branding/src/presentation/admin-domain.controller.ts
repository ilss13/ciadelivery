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
import { SetCustomDomain } from '../application/set-custom-domain';
import { CustomDomainDto, CustomDomainResponse } from './custom-domain.dto';

@ApiTags('admin-branding')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@RequirePermissions('store.configure')
@Controller('api/v1/admin/domain')
export class AdminDomainController {
  constructor(private readonly setCustomDomain: SetCustomDomain) {}

  @Get()
  @ApiOkResponse({ type: CustomDomainResponse })
  get(@Req() request: { actor?: RequestActor }): Promise<CustomDomainResponse> {
    return this.setCustomDomain.get(actorFrom(request));
  }

  @Put()
  @ApiOkResponse({ type: CustomDomainResponse })
  update(
    @Req() request: { actor?: RequestActor },
    @Body() body: CustomDomainDto,
  ): Promise<CustomDomainResponse> {
    return this.setCustomDomain.set(actorFrom(request), body.customDomain);
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
