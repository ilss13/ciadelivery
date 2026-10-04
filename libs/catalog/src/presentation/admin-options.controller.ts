import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantContextInterceptor } from '@ciadelivery/tenancy/guards';
import { PermissionsGuard, RequestActor, RequirePermissions } from '@ciadelivery/users';
import { AdminCatalog } from '../application/admin-catalog';
import {
  CreateOptionDto,
  CreateOptionGroupDto,
  OptionGroupResponse,
  OptionResponse,
  ProductGroupParams,
  ProductIdParam,
  OptionParams,
  UpdateOptionDto,
  UpdateOptionGroupDto,
} from './catalog.dto';
import { actorFrom, groupPatch, optionPatch } from './http';

@ApiTags('admin-catalog')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@RequirePermissions('catalog.manage')
@Controller('api/v1/admin')
export class AdminOptionsController {
  constructor(private readonly catalog: AdminCatalog) {}

  @Post('products/:productId/option-groups')
  @HttpCode(201)
  @ApiOkResponse({ type: OptionGroupResponse })
  createGroup(
    @Req() request: { actor?: RequestActor },
    @Param() params: ProductIdParam,
    @Body() body: CreateOptionGroupDto,
  ) {
    return this.catalog.createOptionGroup(actorFrom(request), params.productId, {
      name: body.name,
      minSelect: body.minSelect,
      maxSelect: body.maxSelect,
      ...(body.sortOrder === undefined ? {} : { sortOrder: body.sortOrder }),
    });
  }

  @Patch('products/:productId/option-groups/:groupId')
  @ApiOkResponse({ type: OptionGroupResponse })
  updateGroup(
    @Req() request: { actor?: RequestActor },
    @Param() params: ProductGroupParams,
    @Body() body: UpdateOptionGroupDto,
  ) {
    return this.catalog.updateOptionGroup(
      actorFrom(request),
      params.productId,
      params.groupId,
      groupPatch(body),
    );
  }

  @Delete('products/:productId/option-groups/:groupId')
  @HttpCode(204)
  @ApiNoContentResponse()
  removeGroup(
    @Req() request: { actor?: RequestActor },
    @Param() params: ProductGroupParams,
  ): Promise<void> {
    return this.catalog.deleteOptionGroup(
      actorFrom(request),
      params.productId,
      params.groupId,
    );
  }

  @Post('products/:productId/option-groups/:groupId/options')
  @HttpCode(201)
  @ApiOkResponse({ type: OptionResponse })
  createOption(
    @Req() request: { actor?: RequestActor },
    @Param() params: ProductGroupParams,
    @Body() body: CreateOptionDto,
  ) {
    return this.catalog.createOption(
      actorFrom(request),
      params.productId,
      params.groupId,
      {
        name: body.name,
        priceCents: body.priceCents,
        available: body.available ?? true,
        ...(body.sortOrder === undefined ? {} : { sortOrder: body.sortOrder }),
      },
    );
  }

  @Patch('option-groups/:groupId/options/:optionId')
  @ApiOkResponse({ type: OptionResponse })
  updateOption(
    @Req() request: { actor?: RequestActor },
    @Param() params: OptionParams,
    @Body() body: UpdateOptionDto,
  ) {
    return this.catalog.updateOption(
      actorFrom(request),
      params.groupId,
      params.optionId,
      optionPatch(body),
    );
  }

  @Delete('option-groups/:groupId/options/:optionId')
  @HttpCode(204)
  @ApiNoContentResponse()
  removeOption(
    @Req() request: { actor?: RequestActor },
    @Param() params: OptionParams,
  ): Promise<void> {
    return this.catalog.deleteOption(
      actorFrom(request),
      params.groupId,
      params.optionId,
    );
  }
}
