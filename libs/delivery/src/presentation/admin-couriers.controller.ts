import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DomainException } from '@ciadelivery/shared';
import { TenantContextInterceptor } from '@ciadelivery/tenancy/guards';
import {
  PermissionsGuard,
  RequestActor,
  RequirePermissions,
} from '@ciadelivery/users';
import {
  AdminCouriers,
  CourierView,
  UpdateCourierCommand,
} from '../application/admin-couriers';
import {
  CourierIdParam,
  CourierPageResponse,
  CourierResponse,
  CreateCourierDto,
  CreatedCourierResponse,
  ListCouriersQuery,
  UpdateCourierDto,
} from './courier.dto';

@ApiTags('admin-couriers')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@Controller('api/v1/admin/couriers')
export class AdminCouriersController {
  constructor(private readonly couriers: AdminCouriers) {}

  @Get()
  @ApiOkResponse({ type: CourierPageResponse })
  async list(
    @Req() request: { actor?: RequestActor },
    @Query() query: ListCouriersQuery,
  ): Promise<CourierPageResponse> {
    const page = await this.couriers.list(
      actorFrom(request),
      query.page ?? 1,
      query.pageSize ?? 20,
      query.active ?? null,
      query.status ?? null,
    );
    return {
      data: page.items.map(toCourier),
      meta: {
        page: page.page,
        pageSize: page.pageSize,
        total: page.total,
        totalPages: page.totalPages,
      },
    };
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions('couriers.manage')
  @ApiCreatedResponse({ type: CreatedCourierResponse })
  async create(
    @Req() request: { actor?: RequestActor },
    @Body() body: CreateCourierDto,
  ): Promise<CreatedCourierResponse> {
    const created = await this.couriers.create(actorFrom(request), {
      name: body.name,
      phone: body.phone,
      userId: body.userId ?? null,
      email: body.email ?? null,
      password: body.password ?? null,
      vehicleType: body.vehicleType ?? null,
      notes: body.notes ?? null,
      status: body.status ?? 'AVAILABLE',
    });
    return { ...toCourier(created), initialPassword: created.initialPassword };
  }

  @Patch(':id')
  @RequirePermissions('couriers.manage')
  @ApiOkResponse({ type: CourierResponse })
  update(
    @Req() request: { actor?: RequestActor },
    @Param() params: CourierIdParam,
    @Body() body: UpdateCourierDto,
  ): Promise<CourierResponse> {
    return this.couriers.update(
      actorFrom(request),
      params.id,
      patchFrom(body),
    );
  }
}

function patchFrom(body: UpdateCourierDto): UpdateCourierCommand {
  const command: UpdateCourierCommand = {};
  if (body.name !== undefined) {
    command.name = body.name;
  }
  if (body.phone !== undefined) {
    command.phone = body.phone;
  }
  if (body.status !== undefined) {
    command.status = body.status;
  }
  if (body.active !== undefined) {
    command.active = body.active;
  }
  if (body.vehicleType !== undefined) {
    command.vehicleType = body.vehicleType;
  }
  if (body.notes !== undefined) {
    command.notes = body.notes;
  }
  return command;
}

function toCourier(courier: CourierView): CourierResponse {
  return {
    id: courier.id,
    userId: courier.userId,
    name: courier.name,
    phone: courier.phone,
    email: courier.email,
    status: courier.status,
    active: courier.active,
    vehicleType: courier.vehicleType,
    notes: courier.notes,
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
