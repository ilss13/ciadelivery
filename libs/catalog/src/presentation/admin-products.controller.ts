import { DomainException, FileInput, memoryFileStorage } from '@ciadelivery/shared';
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantContextInterceptor } from '@ciadelivery/tenancy/guards';
import { PermissionsGuard, RequestActor, RequirePermissions } from '@ciadelivery/users';
import { AdminCatalog } from '../application/admin-catalog';
import { ProductListFilters } from '../domain/catalog';
import {
  CreateProductDto,
  IdParam,
  ListProductsQuery,
  ProductDetailResponse,
  ProductPageResponse,
  StoredFileResponse,
  UpdateProductDto,
} from './catalog.dto';
import { actorFrom, productPatch } from './http';

@ApiTags('admin-catalog')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@RequirePermissions('catalog.manage')
@Controller('api/v1/admin/products')
export class AdminProductsController {
  constructor(private readonly catalog: AdminCatalog) {}

  @Get()
  @ApiOkResponse({ type: ProductPageResponse })
  list(
    @Req() request: { actor?: RequestActor },
    @Query() query: ListProductsQuery,
  ): Promise<ProductPageResponse> {
    const filters: ProductListFilters = {
      ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
      ...(query.active === undefined ? {} : { active: query.active }),
      ...(query.q === undefined || query.q.length === 0
        ? {}
        : { nameQuery: query.q }),
    };
    return this.catalog.listProducts(
      actorFrom(request),
      query.page ?? 1,
      query.pageSize ?? 20,
      filters,
    );
  }

  @Post()
  @HttpCode(201)
  @ApiOkResponse({ type: ProductDetailResponse })
  create(
    @Req() request: { actor?: RequestActor },
    @Body() body: CreateProductDto,
  ): Promise<ProductDetailResponse> {
    return this.catalog.createProduct(actorFrom(request), {
      categoryId: body.categoryId,
      name: body.name,
      description: body.description ?? null,
      priceCents: body.priceCents,
      sku: body.sku ?? null,
      active: body.active ?? true,
      available: body.available ?? true,
      ...(body.sortOrder === undefined ? {} : { sortOrder: body.sortOrder }),
    });
  }

  @Get(':id')
  @ApiOkResponse({ type: ProductDetailResponse })
  get(
    @Req() request: { actor?: RequestActor },
    @Param() params: IdParam,
  ): Promise<ProductDetailResponse> {
    return this.catalog.getProduct(actorFrom(request), params.id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ProductDetailResponse })
  update(
    @Req() request: { actor?: RequestActor },
    @Param() params: IdParam,
    @Body() body: UpdateProductDto,
  ): Promise<ProductDetailResponse> {
    return this.catalog.updateProduct(
      actorFrom(request),
      params.id,
      productPatch(body),
    );
  }

  @Post(':id/image')
  @HttpCode(201)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: StoredFileResponse })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryFileStorage(),
      limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    }),
  )
  uploadImage(
    @Req() request: { actor?: RequestActor },
    @Param() params: IdParam,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<StoredFileResponse> {
    return this.catalog.uploadProductImage(
      actorFrom(request),
      params.id,
      imageFile(file),
    );
  }

  @Delete(':id/image')
  @HttpCode(204)
  @ApiNoContentResponse()
  removeImage(
    @Req() request: { actor?: RequestActor },
    @Param() params: IdParam,
  ): Promise<void> {
    return this.catalog.deleteProductImage(actorFrom(request), params.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(
    @Req() request: { actor?: RequestActor },
    @Param() params: IdParam,
  ): Promise<void> {
    return this.catalog.deleteProduct(actorFrom(request), params.id);
  }
}

interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

function imageFile(file: UploadedImage | undefined): FileInput {
  if (file === undefined || !Buffer.isBuffer(file.buffer)) {
    throw new DomainException(
      'INVALID_FILE',
      'The file is not an accepted image',
      400,
    );
  }

  return {
    buffer: file.buffer,
    mimeType: file.mimetype,
    size: file.size,
    originalName: file.originalname,
    tenantId: '00000000-0000-4000-8000-000000000000',
    kind: 'products',
  };
}
