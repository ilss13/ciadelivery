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
import { GetBranding, SaveBranding } from '../application/branding-settings';
import { BrandingView } from '../domain/branding';
import { BrandingDto } from './branding.dto';

@ApiTags('admin-branding')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@RequirePermissions('store.configure')
@Controller('api/v1/admin/branding')
export class AdminBrandingController {
  constructor(
    private readonly getBranding: GetBranding,
    private readonly saveBranding: SaveBranding,
  ) {}

  @Get()
  @ApiOkResponse({ type: BrandingDto })
  get(@Req() request: { actor?: RequestActor }): Promise<BrandingView> {
    return this.getBranding.execute(actorFrom(request));
  }

  @Put()
  @ApiOkResponse({ type: BrandingDto })
  update(
    @Req() request: { actor?: RequestActor },
    @Body() body: BrandingDto,
  ): Promise<BrandingView> {
    return this.saveBranding.execute(actorFrom(request), body);
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
