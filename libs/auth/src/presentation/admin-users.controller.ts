import { DomainException } from '@ciadelivery/shared';
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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RequestActor } from '@ciadelivery/users';
import {
  CreateTenantUser,
  GetTenantUser,
  ListTenantUsers,
  UpdateTenantUser,
} from '@ciadelivery/users';
import {
  CreateUserDto,
  ListUsersQuery,
  UpdateUserDto,
  UserIdParam,
  UserListResponse,
  UserResponse,
} from './auth.dto';
import { PermissionsGuard, RequirePermissions } from './permissions.guard';
import { toUserBody, toUserPageBody } from './user-response';

@ApiTags('admin-users')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@RequirePermissions('users.manage')
@Controller('api/v1/admin/users')
export class AdminUsersController {
  constructor(
    private readonly listUsers: ListTenantUsers,
    private readonly getUser: GetTenantUser,
    private readonly createUser: CreateTenantUser,
    private readonly updateUser: UpdateTenantUser,
  ) {}

  @Get()
  @ApiOkResponse({ type: UserListResponse })
  async list(
    @Req() request: { actor?: RequestActor },
    @Query() query: ListUsersQuery,
  ): Promise<UserListResponse> {
    const page = await this.listUsers.execute(
      actorFrom(request),
      query.page ?? 1,
      query.pageSize ?? 20,
    );
    return toUserPageBody(page);
  }

  @Get(':id')
  @ApiOkResponse({ type: UserResponse })
  async get(
    @Req() request: { actor?: RequestActor },
    @Param() params: UserIdParam,
  ): Promise<UserResponse> {
    return toUserBody(
      await this.getUser.execute(actorFrom(request), params.id),
    );
  }

  @Post()
  @HttpCode(201)
  @ApiOkResponse({ type: UserResponse })
  async create(
    @Req() request: { actor?: RequestActor },
    @Body() body: CreateUserDto,
  ): Promise<UserResponse> {
    const created = await this.createUser.execute({
      actor: actorFrom(request),
      name: body.name,
      email: body.email,
      password: body.password,
      role: body.role,
      ...(body.permissionOverrides === undefined
        ? {}
        : { permissionOverrides: body.permissionOverrides }),
    });
    return toUserBody(created);
  }

  @Patch(':id')
  @ApiOkResponse({ type: UserResponse })
  async update(
    @Req() request: { actor?: RequestActor },
    @Param() params: UserIdParam,
    @Body() body: UpdateUserDto,
  ): Promise<UserResponse> {
    const updated = await this.updateUser.execute({
      actor: actorFrom(request),
      userId: params.id,
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.role === undefined ? {} : { role: body.role }),
      ...(body.status === undefined ? {} : { status: body.status }),
      ...(body.password === undefined ? {} : { password: body.password }),
      ...(body.permissionOverrides === undefined
        ? {}
        : { permissionOverrides: body.permissionOverrides }),
    });
    return toUserBody(updated);
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
