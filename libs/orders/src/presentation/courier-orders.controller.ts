import {
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
import {
  PermissionsGuard,
  RequestActor,
  RequirePermissions,
} from '@ciadelivery/users';
import { CourierOrders } from '../application/courier-orders';
import {
  CourierHistoryItem,
  CourierTaskDetail,
  CourierTaskSummary,
} from '../domain/courier-task';
import { actorFrom } from './http';
import {
  CourierHistoryQuery,
  CourierHistoryResponse,
  CourierOrderDetailResponse,
  CourierOrderListResponse,
  CourierOrderResponse,
} from './courier.dto';
import { OrderIdParam } from './order.dto';

@ApiTags('courier-orders')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@Controller('api/v1/courier')
export class CourierOrdersController {
  constructor(private readonly orders: CourierOrders) {}

  @Get('orders')
  @RequirePermissions('orders.read')
  @ApiOkResponse({ type: CourierOrderListResponse })
  async list(
    @Req() request: { actor?: RequestActor },
  ): Promise<CourierOrderListResponse> {
    const orders = await this.orders.list(actorFrom(request));
    return { data: orders.map(toSummary) };
  }

  @Get('orders/:id')
  @RequirePermissions('orders.read')
  @ApiOkResponse({ type: CourierOrderDetailResponse })
  get(
    @Req() request: { actor?: RequestActor },
    @Param() params: OrderIdParam,
  ): Promise<CourierOrderDetailResponse> {
    return this.orders.get(actorFrom(request), params.id).then(toDetail);
  }

  @Post('orders/:id/start')
  @HttpCode(200)
  @RequirePermissions('orders.deliver')
  @ApiOkResponse({ type: CourierOrderDetailResponse })
  start(
    @Req() request: { actor?: RequestActor },
    @Param() params: OrderIdParam,
  ): Promise<CourierOrderDetailResponse> {
    return this.orders.start(actorFrom(request), params.id).then(toDetail);
  }

  @Post('orders/:id/complete')
  @HttpCode(200)
  @RequirePermissions('orders.deliver')
  @ApiOkResponse({ type: CourierOrderDetailResponse })
  complete(
    @Req() request: { actor?: RequestActor },
    @Param() params: OrderIdParam,
  ): Promise<CourierOrderDetailResponse> {
    return this.orders.complete(actorFrom(request), params.id).then(toDetail);
  }

  @Get('deliveries')
  @RequirePermissions('orders.read')
  @ApiOkResponse({ type: CourierHistoryResponse })
  async history(
    @Req() request: { actor?: RequestActor },
    @Query() query: CourierHistoryQuery,
  ): Promise<CourierHistoryResponse> {
    const page = await this.orders.history(
      actorFrom(request),
      query.page ?? 1,
      query.pageSize ?? 20,
    );
    return {
      data: page.data.map(toHistory),
      meta: {
        page: page.page,
        pageSize: page.pageSize,
        total: page.total,
        totalPages: page.totalPages,
      },
    };
  }
}

function toSummary(order: CourierTaskSummary): CourierOrderResponse {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    totalCents: order.totalCents,
    address: order.address,
  };
}

function toDetail(order: CourierTaskDetail): CourierOrderDetailResponse {
  return {
    ...toSummary(order),
    customerPhone: order.customerPhone,
  };
}

function toHistory(order: CourierHistoryItem) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    totalCents: order.totalCents,
    deliveredAt: order.deliveredAt,
    address: order.address,
  };
}
