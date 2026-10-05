import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { TenantContextInterceptor } from '@ciadelivery/tenancy/guards';
import { PermissionsGuard, RequestActor, RequirePermissions } from '@ciadelivery/users';
import { AdminCustomers } from '../application/admin-customers';
import { CustomerPrivacy } from '../application/customer-privacy';
import {
  CustomerDetailResponse,
  CustomerPageResponse,
  IdParam,
  ListCustomersQuery,
} from './customer.dto';
import { actorFrom } from './http';
import {
  AnonymizeCustomerDto,
  CustomerExportResponse,
} from './privacy.dto';

@ApiTags('admin-customers')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@RequirePermissions('customers.read')
@Controller('api/v1/admin/customers')
export class AdminCustomersController {
  constructor(
    private readonly customers: AdminCustomers,
    private readonly privacy: CustomerPrivacy,
  ) {}

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

  @Get(':id/export')
  @RequirePermissions('users.manage')
  @ApiOkResponse({ type: CustomerExportResponse })
  exportCustomer(
    @Req() request: { actor?: RequestActor },
    @Param() params: IdParam,
  ): Promise<CustomerExportResponse> {
    return this.privacy.export(actorFrom(request), params.id);
  }

  @Post(':id/anonymize')
  @HttpCode(200)
  @RequirePermissions('users.manage')
  @ApiOkResponse({ type: CustomerDetailResponse })
  anonymize(
    @Req() request: { actor?: RequestActor },
    @Param() params: IdParam,
    @Body() body: AnonymizeCustomerDto,
  ): Promise<CustomerDetailResponse> {
    return this.privacy.anonymize(actorFrom(request), params.id, body.phone);
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
