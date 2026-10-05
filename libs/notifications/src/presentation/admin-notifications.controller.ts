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
import { DomainException } from '@ciadelivery/shared';
import { TenantContextInterceptor } from '@ciadelivery/tenancy/guards';
import { PermissionsGuard, RequestActor, RequirePermissions } from '@ciadelivery/users';
import { AdminNotifications } from '../application/admin-notifications';
import { NotificationRecord } from '../domain/notification';
import {
  ListNotificationsQuery,
  NotificationIdParam,
  NotificationPageResponse,
  NotificationResponse,
} from './notification.dto';

@ApiTags('admin-notifications')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@RequirePermissions('orders.read')
@Controller('api/v1/admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly notifications: AdminNotifications) {}

  @Get()
  @ApiOkResponse({ type: NotificationPageResponse })
  async list(
    @Req() request: { actor?: RequestActor },
    @Query() query: ListNotificationsQuery,
  ): Promise<NotificationPageResponse> {
    const page = await this.notifications.list(
      actorFrom(request),
      query.page ?? 1,
      query.pageSize ?? 20,
    );
    return {
      data: page.data.map(toResponse),
      meta: page.meta,
    };
  }

  @Post(':id/read')
  @HttpCode(200)
  @ApiOkResponse({ type: NotificationResponse })
  async markRead(
    @Req() request: { actor?: RequestActor },
    @Param() params: NotificationIdParam,
  ): Promise<NotificationResponse> {
    return toResponse(
      await this.notifications.markRead(actorFrom(request), params.id),
    );
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

function toResponse(notification: NotificationRecord): NotificationResponse {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    orderId: notification.orderId,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
}
