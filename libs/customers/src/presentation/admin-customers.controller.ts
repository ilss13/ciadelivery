import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { TenantContextInterceptor } from '@ciadelivery/tenancy/guards';
import { PermissionsGuard, RequestActor, RequirePermissions } from '@ciadelivery/users';
import { AdminCustomers } from '../application/admin-customers';
import {
  CustomerDetailResponse,
  CustomerPageResponse,
  IdParam,
  ListCustomersQuery,
} from './customer.dto';
import { actorFrom } from './http';

@ApiTags('admin-customers')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@RequirePermissions('customers.read')
@Controller('api/v1/admin/customers')
export class AdminCustomersController {
  constructor(private readonly customers: AdminCustomers) {}

  @Get()
  @ApiOkResponse({ type: CustomerPageResponse })
  list(
    @Req() request: { actor?: RequestActor },
    @Query() query: ListCustomersQuery,
  ): Promise<CustomerPageResponse> {
    return this.customers.list(actorFrom(request), query.page ?? 1, query.pageSize ?? 20, {
      ...(query.phone === undefined ? {} : { phone: query.phone }),
      ...(query.q === undefined ? {} : { name: query.q }),
    });
  }

  @Get(':id')
  @ApiOkResponse({ type: CustomerDetailResponse })
  get(
    @Req() request: { actor?: RequestActor },
    @Param() params: IdParam,
  ): Promise<CustomerDetailResponse> {
    return this.customers.get(actorFrom(request), params.id);
  }
}
