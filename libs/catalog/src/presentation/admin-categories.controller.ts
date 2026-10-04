import {
  Body,
  Controller,
  Delete,
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
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantContextInterceptor } from '@ciadelivery/tenancy/guards';
import { PermissionsGuard, RequestActor, RequirePermissions } from '@ciadelivery/users';
import { AdminCatalog } from '../application/admin-catalog';
import {
  CategoryPageResponse,
  CategoryResponse,
  CreateCategoryDto,
  IdParam,
  PageQueryDto,
  UpdateCategoryDto,
} from './catalog.dto';
import { actorFrom, categoryPatch } from './http';

@ApiTags('admin-catalog')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@RequirePermissions('catalog.manage')
@Controller('api/v1/admin/categories')
export class AdminCategoriesController {
  constructor(private readonly catalog: AdminCatalog) {}

  @Get()
  @ApiOkResponse({ type: CategoryPageResponse })
  list(
    @Req() request: { actor?: RequestActor },
    @Query() query: PageQueryDto,
  ): Promise<CategoryPageResponse> {
    return this.catalog.listCategories(
      actorFrom(request),
      query.page ?? 1,
      query.pageSize ?? 20,
    );
  }

  @Post()
  @HttpCode(201)
  @ApiOkResponse({ type: CategoryResponse })
  create(
    @Req() request: { actor?: RequestActor },
    @Body() body: CreateCategoryDto,
  ): Promise<CategoryResponse> {
    return this.catalog.createCategory(actorFrom(request), {
      name: body.name,
      description: body.description ?? null,
      active: body.active ?? true,
      ...(body.sortOrder === undefined ? {} : { sortOrder: body.sortOrder }),
    });
  }

  @Patch(':id')
  @ApiOkResponse({ type: CategoryResponse })
  update(
    @Req() request: { actor?: RequestActor },
    @Param() params: IdParam,
    @Body() body: UpdateCategoryDto,
  ): Promise<CategoryResponse> {
    return this.catalog.updateCategory(
      actorFrom(request),
      params.id,
      categoryPatch(body),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(
    @Req() request: { actor?: RequestActor },
    @Param() params: IdParam,
  ): Promise<void> {
    return this.catalog.deleteCategory(actorFrom(request), params.id);
  }
}
