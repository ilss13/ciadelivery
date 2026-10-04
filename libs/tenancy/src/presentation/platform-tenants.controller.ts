import { APP_CONFIG, AppConfig } from '@ciadelivery/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateTenant } from '../application/create-tenant';
import { GetTenant } from '../application/get-tenant';
import { ListTenants } from '../application/list-tenants';
import { UpdateTenant } from '../application/update-tenant';
import { SuperAdminGuard } from './super-admin.guard';
import {
  CreateTenantDto,
  ListTenantsQuery,
  TenantIdParam,
  TenantListResponse,
  TenantResponse,
  UpdateTenantDto,
} from './tenant.dto';
import { toTenantBody, toTenantPageBody } from './tenant-response';

@ApiTags('platform-tenants')
@ApiBearerAuth('bearer')
@UseGuards(SuperAdminGuard)
@Controller('api/v1/platform/tenants')
export class PlatformTenantsController {
  constructor(
    private readonly createTenant: CreateTenant,
    private readonly listTenants: ListTenants,
    private readonly getTenant: GetTenant,
    private readonly updateTenant: UpdateTenant,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOkResponse({ type: TenantResponse })
  async create(@Body() body: CreateTenantDto): Promise<TenantResponse> {
    const created = await this.createTenant.execute({
      name: body.name,
      slug: body.slug,
      phone: body.phone,
      address: body.address,
    });
    return toTenantBody(created);
  }

  @Get()
  @ApiOkResponse({ type: TenantListResponse })
  async list(@Query() query: ListTenantsQuery): Promise<TenantListResponse> {
    const page = await this.listTenants.execute(
      query.page ?? 1,
      query.pageSize ?? 20,
    );
    return toTenantPageBody(page);
  }

  @Get(':id')
  @ApiOkResponse({ type: TenantResponse })
  async get(@Param() params: TenantIdParam): Promise<TenantResponse> {
    return toTenantBody(await this.getTenant.execute(params.id));
  }

  @Patch(':id')
  @ApiOkResponse({ type: TenantResponse })
  async update(
    @Param() params: TenantIdParam,
    @Body() body: UpdateTenantDto,
  ): Promise<TenantResponse> {
    const updated = await this.updateTenant.execute({
      id: params.id,
      platformDomain: this.config.platformDomain,
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.status === undefined ? {} : { status: body.status }),
      ...(body.planCode === undefined ? {} : { planCode: body.planCode }),
      ...(body.customDomain === undefined
        ? {}
        : { customDomain: body.customDomain }),
    });
    return toTenantBody(updated);
  }
}
