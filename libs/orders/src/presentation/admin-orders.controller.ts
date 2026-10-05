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
import { AdminOrders } from '../application/admin-orders';
import { actorFrom } from './http';
import {
  AdminOrderPageResponse,
  AdminOrderResponse,
  ListOrdersQuery,
  OrderIdParam,
} from './order.dto';

@ApiTags('admin-orders')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@RequirePermissions('orders.read')
@Controller('api/v1/admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrders) {}

  @Get()
  @ApiOkResponse({ type: AdminOrderPageResponse })
  list(
    @Req() request: { actor?: RequestActor },
    @Query() query: ListOrdersQuery,
  ): Promise<AdminOrderPageResponse> {
    return this.orders.list(actorFrom(request), query.page ?? 1, query.pageSize ?? 20);
  }

  @Get(':id')
  @ApiOkResponse({ type: AdminOrderResponse })
  get(
    @Req() request: { actor?: RequestActor },
    @Param() params: OrderIdParam,
  ): Promise<AdminOrderResponse> {
    return this.orders.get(actorFrom(request), params.id);
  }
}
