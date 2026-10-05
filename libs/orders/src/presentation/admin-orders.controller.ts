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
import { AdminOrders } from '../application/admin-orders';
import { AdvanceDelivery } from '../application/advance-delivery';
import { AssignCourier } from '../application/assign-courier';
import { TransitionAdminOrder } from '../application/transition-admin-order';
import { AssignCourierDto } from './courier.dto';
import { actorFrom } from './http';
import {
  AdminOrderDetailResponse,
  AdminOrderPageResponse,
  AdminOrderResponse,
  CancelOrderDto,
  ListOrdersQuery,
  OptionalOrderNoteDto,
  OrderIdParam,
} from './order.dto';

@ApiTags('admin-orders')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@RequirePermissions('orders.read')
@Controller('api/v1/admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly orders: AdminOrders,
    private readonly transitions: TransitionAdminOrder,
    private readonly assignments: AssignCourier,
    private readonly delivery: AdvanceDelivery,
  ) {}

  @Get()
  @ApiOkResponse({ type: AdminOrderPageResponse })
  list(
    @Req() request: { actor?: RequestActor },
    @Query() query: ListOrdersQuery,
  ): Promise<AdminOrderPageResponse> {
    return this.orders.list(actorFrom(request), query);
  }

  @Get(':id')
  @ApiOkResponse({ type: AdminOrderDetailResponse })
  get(
    @Req() request: { actor?: RequestActor },
    @Param() params: OrderIdParam,
  ): Promise<AdminOrderDetailResponse> {
    return this.orders.get(actorFrom(request), params.id);
  }

  @Post(':id/accept')
  @HttpCode(200)
  @RequirePermissions('orders.accept')
  @ApiOkResponse({ type: AdminOrderResponse })
  accept(
    @Req() request: { actor?: RequestActor },
    @Param() params: OrderIdParam,
  ): Promise<AdminOrderResponse> {
    return this.transitions.execute(actorFrom(request), params.id, 'accept', null);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions('orders.accept')
  @ApiOkResponse({ type: AdminOrderResponse })
  reject(
    @Req() request: { actor?: RequestActor },
    @Param() params: OrderIdParam,
    @Body() body: OptionalOrderNoteDto,
  ): Promise<AdminOrderResponse> {
    return this.transitions.execute(
      actorFrom(request),
      params.id,
      'reject',
      body.note ?? null,
    );
  }

  @Post(':id/start-preparation')
  @HttpCode(200)
  @RequirePermissions('orders.prepare')
  @ApiOkResponse({ type: AdminOrderResponse })
  startPreparation(
    @Req() request: { actor?: RequestActor },
    @Param() params: OrderIdParam,
  ): Promise<AdminOrderResponse> {
    return this.transitions.execute(
      actorFrom(request),
      params.id,
      'start-preparation',
      null,
    );
  }

  @Post(':id/ready')
  @HttpCode(200)
  @RequirePermissions('orders.prepare')
  @ApiOkResponse({ type: AdminOrderResponse })
  ready(
    @Req() request: { actor?: RequestActor },
    @Param() params: OrderIdParam,
  ): Promise<AdminOrderResponse> {
    return this.transitions.execute(actorFrom(request), params.id, 'ready', null);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions('orders.accept')
  @ApiOkResponse({ type: AdminOrderResponse })
  cancel(
    @Req() request: { actor?: RequestActor },
    @Param() params: OrderIdParam,
    @Body() body: CancelOrderDto,
  ): Promise<AdminOrderResponse> {
    return this.transitions.execute(
      actorFrom(request),
      params.id,
      'cancel',
      body.note,
    );
  }

  @Post(':id/assign-courier')
  @HttpCode(200)
  @RequirePermissions('orders.assign_courier')
  @ApiOkResponse({ type: AdminOrderResponse })
  assignCourier(
    @Req() request: { actor?: RequestActor },
    @Param() params: OrderIdParam,
    @Body() body: AssignCourierDto,
  ): Promise<AdminOrderResponse> {
    return this.assignments.execute(actorFrom(request), params.id, body.courierId);
  }

  @Post(':id/dispatch')
  @HttpCode(200)
  @RequirePermissions('orders.assign_courier')
  @ApiOkResponse({ type: AdminOrderResponse })
  dispatch(
    @Req() request: { actor?: RequestActor },
    @Param() params: OrderIdParam,
  ): Promise<AdminOrderResponse> {
    return this.delivery.dispatch(actorFrom(request), params.id);
  }

  @Post(':id/deliver')
  @HttpCode(200)
  @RequirePermissions('orders.deliver')
  @ApiOkResponse({ type: AdminOrderResponse })
  deliver(
    @Req() request: { actor?: RequestActor },
    @Param() params: OrderIdParam,
  ): Promise<AdminOrderResponse> {
    return this.delivery.deliver(actorFrom(request), params.id);
  }

  @Post(':id/complete-pickup')
  @HttpCode(200)
  @RequirePermissions('orders.deliver')
  @ApiOkResponse({ type: AdminOrderResponse })
  completePickup(
    @Req() request: { actor?: RequestActor },
    @Param() params: OrderIdParam,
  ): Promise<AdminOrderResponse> {
    return this.transitions.execute(
      actorFrom(request),
      params.id,
      'complete-pickup',
      null,
    );
  }
}
