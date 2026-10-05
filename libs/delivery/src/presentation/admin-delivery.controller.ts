import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { DomainException } from '@ciadelivery/shared';
import { TenantContextInterceptor } from '@ciadelivery/tenancy/guards';
import {
  PermissionsGuard,
  RequestActor,
  RequirePermissions,
} from '@ciadelivery/users';
import { AdminDelivery } from '../application/admin-delivery';
import { DeliveryFeeZone } from '../domain/delivery-fee';
import { DeliveryZoneRecord } from '../domain/delivery-policy';
import {
  DeliveryConfigResponse,
  DeliveryZoneIdParam,
  DeliveryZoneInputDto,
  DeliveryZoneListResponse,
  DeliveryZoneResponse,
  PatchDeliveryZoneDto,
  ReplaceDeliveryZonesDto,
  UpdateDeliveryConfigDto,
} from './delivery.dto';

@ApiTags('admin-delivery')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@RequirePermissions('store.configure')
@Controller('api/v1/admin/delivery')
export class AdminDeliveryController {
  constructor(private readonly delivery: AdminDelivery) {}

  @Get('config')
  @ApiOkResponse({ type: DeliveryConfigResponse })
  getConfig(
    @Req() request: { actor?: RequestActor },
  ): Promise<DeliveryConfigResponse> {
    return this.delivery.getConfig(actorFrom(request));
  }

  @Put('config')
  @ApiOperation({
    summary: 'Update delivery configuration',
    description:
      'Saves radius, fee mode and timing. Include zones to replace the whole set and reject overlaps.',
  })
  @ApiOkResponse({ type: DeliveryConfigResponse })
  updateConfig(
    @Req() request: { actor?: RequestActor },
    @Body() body: UpdateDeliveryConfigDto,
  ): Promise<DeliveryConfigResponse> {
    return this.delivery.updateConfig(
      actorFrom(request),
      {
        deliveryEnabled: body.deliveryEnabled,
        pickupEnabled: body.pickupEnabled,
        maxRadiusKm: body.maxRadiusKm,
        feeMode: body.feeMode,
        flatFeeCents: body.flatFeeCents,
        estimatedMinutes: body.estimatedMinutes,
      },
      body.zones === undefined ? null : body.zones.map(toDraft),
    );
  }

  @Get('zones')
  @ApiOkResponse({ type: DeliveryZoneListResponse })
  async listZones(
    @Req() request: { actor?: RequestActor },
  ): Promise<DeliveryZoneListResponse> {
    return { zones: (await this.delivery.listZones(actorFrom(request))).map(toZone) };
  }

  @Put('zones')
  @ApiOperation({
    summary: 'Replace every delivery zone',
    description:
      'Replaces the full list in one request so the settings screen can save at once. POST, PATCH and DELETE change a single zone.',
  })
  @ApiOkResponse({ type: DeliveryZoneListResponse })
  async replaceZones(
    @Req() request: { actor?: RequestActor },
    @Body() body: ReplaceDeliveryZonesDto,
  ): Promise<DeliveryZoneListResponse> {
    const zones = await this.delivery.replaceZones(
      actorFrom(request),
      body.zones.map(toDraft),
    );
    return { zones: zones.map(toZone) };
  }

  @Post('zones')
  @HttpCode(200)
  @ApiOkResponse({ type: DeliveryZoneResponse })
  addZone(
    @Req() request: { actor?: RequestActor },
    @Body() body: DeliveryZoneInputDto,
  ): Promise<DeliveryZoneResponse> {
    return this.delivery
      .addZone(actorFrom(request), {
        fromKm: body.fromKm,
        toKm: body.toKm,
        feeCents: body.feeCents,
      })
      .then(toZone);
  }

  @Patch('zones/:id')
  @ApiOkResponse({ type: DeliveryZoneResponse })
  updateZone(
    @Req() request: { actor?: RequestActor },
    @Param() params: DeliveryZoneIdParam,
    @Body() body: PatchDeliveryZoneDto,
  ): Promise<DeliveryZoneResponse> {
    return this.delivery
      .updateZone(actorFrom(request), params.id, {
        ...(body.fromKm === undefined ? {} : { fromKm: body.fromKm }),
        ...(body.toKm === undefined ? {} : { toKm: body.toKm }),
        ...(body.feeCents === undefined ? {} : { feeCents: body.feeCents }),
      })
      .then(toZone);
  }

  @Delete('zones/:id')
  @HttpCode(204)
  @ApiNoContentResponse()
  deleteZone(
    @Req() request: { actor?: RequestActor },
    @Param() params: DeliveryZoneIdParam,
  ): Promise<void> {
    return this.delivery.deleteZone(actorFrom(request), params.id);
  }
}

function toDraft(zone: DeliveryZoneInputDto, index: number): DeliveryFeeZone {
  return {
    fromKm: zone.fromKm,
    toKm: zone.toKm,
    feeCents: zone.feeCents,
    sortOrder: index,
  };
}

function toZone(zone: DeliveryZoneRecord): DeliveryZoneResponse {
  return {
    id: zone.id,
    fromKm: zone.fromKm,
    toKm: zone.toKm,
    feeCents: zone.feeCents,
    sortOrder: zone.sortOrder,
  };
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
