import { Controller, Get, Param, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  PublicTenantGuard,
  TenantContextInterceptor,
} from '@ciadelivery/tenancy/guards';
import { PublicCatalog } from '../application/public-catalog';
import {
  CategoryPageResponse,
  IdParam,
  PageQueryDto,
  ProductDetailResponse,
  PublicProductPageResponse,
  PublicProductsQuery,
} from './catalog.dto';

@ApiTags('public-catalog')
@ApiHeader({
  name: 'X-Tenant-Host',
  required: false,
  description:
    'Replaces the Host header only when NODE_ENV is local or development',
})
@UseGuards(PublicTenantGuard)
@UseInterceptors(TenantContextInterceptor)
@Controller('api/v1/public/categories')
export class PublicCategoriesController {
  constructor(private readonly catalog: PublicCatalog) {}

  @Get()
  @ApiOkResponse({ type: CategoryPageResponse })
  list(@Query() query: PageQueryDto): Promise<CategoryPageResponse> {
    return this.catalog.listCategories(query.page ?? 1, query.pageSize ?? 20);
  }
}

@ApiTags('public-catalog')
@ApiHeader({
  name: 'X-Tenant-Host',
  required: false,
  description:
    'Replaces the Host header only when NODE_ENV is local or development',
})
@UseGuards(PublicTenantGuard)
@UseInterceptors(TenantContextInterceptor)
@Controller('api/v1/public/products')
export class PublicProductsController {
  constructor(private readonly catalog: PublicCatalog) {}

  @Get()
  @ApiOkResponse({ type: PublicProductPageResponse })
  list(@Query() query: PublicProductsQuery): Promise<PublicProductPageResponse> {
    return this.catalog.listProducts(
      query.page ?? 1,
      query.pageSize ?? 20,
      query.categoryId,
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: ProductDetailResponse })
  get(@Param() params: IdParam): Promise<ProductDetailResponse> {
    return this.catalog.getProduct(params.id);
  }
}
