import { DomainException } from '@ciadelivery/shared';
import { RequestActor } from '@ciadelivery/users';
import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  STORES,
  Stores,
  TENANT_REPOSITORY,
  TenantRepository,
} from '@ciadelivery/tenancy';
import { SuperAdminGuard } from '@ciadelivery/tenancy';
import { CreateTenantOwner } from '@ciadelivery/users';
import { CreateOwnerDto, UserIdParam, UserResponse } from './auth.dto';
import { toUserBody } from './user-response';

@ApiTags('platform-tenants')
@ApiBearerAuth('bearer')
@UseGuards(SuperAdminGuard)
@Controller('api/v1/platform/tenants')
export class PlatformOwnerController {
  constructor(
    private readonly createOwner: CreateTenantOwner,
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
    @Inject(STORES) private readonly stores: Stores,
  ) {}

  @Post(':id/owner')
  @HttpCode(201)
  @ApiOkResponse({ type: UserResponse })
  async create(
    @Req() request: { actor?: RequestActor },
    @Param() params: UserIdParam,
    @Body() body: CreateOwnerDto,
  ): Promise<UserResponse> {
    const tenant = await this.tenants.findById(params.id);
    if (tenant === null) {
      throw new DomainException(
        'TENANT_NOT_FOUND',
        'The tenant was not found',
        404,
      );
    }

    const store = await this.stores.findByTenantId(tenant.id);
    if (store === null) {
      throw new DomainException(
        'STORE_NOT_FOUND',
        'The store was not found',
        404,
      );
    }

    const actor = request.actor;
    if (actor === undefined) {
      throw new DomainException(
        'PLATFORM_UNAUTHORIZED',
        'Platform authentication is required',
        401,
      );
    }
    const owner = await this.createOwner.execute({
      actor,
      tenantId: tenant.id,
      storeId: store.id,
      name: body.name,
      email: body.email,
      password: body.password,
    });
    return toUserBody(owner);
  }
}
