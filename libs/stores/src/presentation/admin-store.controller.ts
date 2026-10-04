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
import { PermissionsGuard, RequestActor, RequirePermissions } from '@ciadelivery/users';
import {
  GetStoreSettings,
  UpdateStoreSettings,
} from '../application/store-settings';
import { StoreSettings } from '../domain/current-store';
import { StoreSettingsResponse, UpdateStoreDto } from './admin-store.dto';

@ApiTags('admin-store')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@RequirePermissions('store.configure')
@Controller('api/v1/admin/store')
export class AdminStoreController {
  constructor(
    private readonly getStoreSettings: GetStoreSettings,
    private readonly updateStoreSettings: UpdateStoreSettings,
  ) {}

  @Get()
  @ApiOkResponse({ type: StoreSettingsResponse })
  get(@Req() request: { actor?: RequestActor }): Promise<StoreSettings> {
    return this.getStoreSettings.execute(actorFrom(request));
  }

  @Put()
  @ApiOkResponse({ type: StoreSettingsResponse })
  update(
    @Req() request: { actor?: RequestActor },
    @Body() body: UpdateStoreDto,
  ): Promise<StoreSettings> {
    return this.updateStoreSettings.execute(actorFrom(request), {
      name: body.name,
      phone: body.phone,
      address: body.address,
      minimumOrderCents: body.minimumOrderCents,
      isManuallyClosed: body.isManuallyClosed,
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
