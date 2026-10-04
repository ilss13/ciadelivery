import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function emptyToNull(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function optionalBoolean(value: unknown): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  return value;
}

export class PageQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class ListProductsQuery extends PageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  q?: string;
}

export class PublicProductsQuery extends PageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;
}

export class IdParam {
  @IsUUID('4')
  id!: string;
}

export class ProductIdParam {
  @IsUUID('4')
  productId!: string;
}

export class ProductGroupParams {
  @IsUUID('4')
  productId!: string;

  @IsUUID('4')
  groupId!: string;
}

export class OptionParams {
  @IsUUID('4')
  groupId!: string;

  @IsUUID('4')
  optionId!: string;
}

export class CreateCategoryDto {
  @ApiProperty({ example: 'Pizzas' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Pizzas' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateProductDto {
  @ApiProperty()
  @IsUUID('4')
  categoryId!: string;

  @ApiProperty({ example: 'Margherita' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiProperty({ example: 3990 })
  @IsInt()
  @Min(0)
  @Max(2147483647)
  priceCents!: number;

  @ApiPropertyOptional({ nullable: true, type: String })
  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;
}

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  priceCents?: number;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  @MaxLength(64)
  sku?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @IsString()
  @MaxLength(500)
  imageKey?: string | null;
}

export class CreateOptionGroupDto {
  @ApiProperty({ example: 'Tamanho' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  @Max(100)
  minSelect!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(100)
  maxSelect!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;
}

export class UpdateOptionGroupDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  minSelect?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxSelect?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;
}

export class CreateOptionDto {
  @ApiProperty({ example: 'Grande' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 500 })
  @IsInt()
  @Min(0)
  @Max(2147483647)
  priceCents!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;
}

export class UpdateOptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  priceCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;
}

export class PageMetaResponse {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class CategoryResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class CategoryPageResponse {
  @ApiProperty({ type: [CategoryResponse] })
  data!: CategoryResponse[];

  @ApiProperty({ type: PageMetaResponse })
  meta!: PageMetaResponse;
}

export class OptionResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  priceCents!: number;

  @ApiProperty()
  available!: boolean;

  @ApiProperty()
  sortOrder!: number;
}

export class OptionGroupResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  minSelect!: number;

  @ApiProperty()
  maxSelect!: number;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty({ type: [OptionResponse] })
  options!: OptionResponse[];
}

export class ProductResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  categoryId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty()
  priceCents!: number;

  @ApiProperty({ nullable: true, type: String })
  sku!: string | null;

  @ApiProperty({ nullable: true, type: String })
  imageKey!: string | null;

  @ApiProperty({ nullable: true, type: String })
  imageUrl!: string | null;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  available!: boolean;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class StoredFileResponse {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  url!: string;
}

export class ProductDetailResponse extends ProductResponse {
  @ApiProperty({ type: [OptionGroupResponse] })
  optionGroups!: OptionGroupResponse[];
}

export class ProductPageResponse {
  @ApiProperty({ type: [ProductResponse] })
  data!: ProductResponse[];

  @ApiProperty({ type: PageMetaResponse })
  meta!: PageMetaResponse;
}

export class PublicProductPageResponse {
  @ApiProperty({ type: [ProductDetailResponse] })
  data!: ProductDetailResponse[];

  @ApiProperty({ type: PageMetaResponse })
  meta!: PageMetaResponse;
}

export class ValidateCartItemDto {
  @ApiProperty()
  @IsUUID('4')
  productId!: string;

  @ApiProperty({ minimum: 1, maximum: 99 })
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  optionIds!: string[];

  @ApiPropertyOptional({ maxLength: 280 })
  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return undefined;
    }
    return typeof value === 'string' ? value.trim() : value;
  })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  notes?: string;
}

export class ValidateCartDto {
  @ApiProperty({ type: [ValidateCartItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValidateCartItemDto)
  items!: ValidateCartItemDto[];
}

export class ValidatedCartOptionResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  priceCents!: number;
}

export class ValidatedCartItemResponse {
  @ApiProperty()
  itemIndex!: number;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  unitPriceCents!: number;

  @ApiProperty({ type: [ValidatedCartOptionResponse] })
  options!: ValidatedCartOptionResponse[];

  @ApiProperty({ nullable: true, type: String })
  notes!: string | null;

  @ApiProperty()
  subtotalCents!: number;
}

export class CartValidationErrorResponse {
  @ApiProperty()
  code!: string;

  @ApiProperty({ nullable: true, type: Number })
  itemIndex!: number | null;

  @ApiProperty()
  message!: string;
}

export class CartValidationResponse {
  @ApiProperty({ type: [ValidatedCartItemResponse] })
  items!: ValidatedCartItemResponse[];

  @ApiProperty()
  subtotalCents!: number;

  @ApiProperty()
  minimumOrderCents!: number;

  @ApiProperty()
  meetsMinimumOrder!: boolean;

  @ApiProperty()
  storeOpen!: boolean;

  @ApiProperty()
  valid!: boolean;

  @ApiProperty({ type: [CartValidationErrorResponse] })
  errors!: CartValidationErrorResponse[];
}
