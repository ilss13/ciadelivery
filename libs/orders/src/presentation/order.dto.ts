import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PAYMENT_METHOD_CODES } from '@ciadelivery/customers';
import { ORDER_STATUSES } from '../domain/order-status';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function emptyToNull(value: unknown): unknown {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export class OrderCustomerDto {
  @ApiProperty({ example: 'Ana' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: '11988887777' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  phone!: string;
}

export class OrderAddressDto {
  @ApiProperty()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  line!: string;

  @ApiProperty()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  number!: string;

  @ApiProperty()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  district!: string;

  @ApiProperty()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  city!: string;

  @ApiProperty({ example: 'SP' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  state!: string;

  @ApiProperty({ example: '01001000' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  postalCode!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(80)
  complement?: string | null;
}

export class OrderConsentsDto {
  @ApiProperty()
  @IsBoolean()
  operational!: boolean;

  @ApiProperty()
  @IsBoolean()
  marketing!: boolean;

  @ApiProperty({ example: '2026-10-02' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  policyVersion!: string;
}

export class CreateOrderItemDto {
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

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 280 })
  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(280)
  notes?: string | null;
}

export class CreateOrderDto {
  @ApiProperty({ type: OrderCustomerDto })
  @ValidateNested()
  @Type(() => OrderCustomerDto)
  customer!: OrderCustomerDto;

  @ApiProperty({ enum: ['DELIVERY', 'PICKUP'] })
  @IsIn(['DELIVERY', 'PICKUP'])
  fulfillment!: 'DELIVERY' | 'PICKUP';

  @ApiPropertyOptional({ type: OrderAddressDto, nullable: true })
  @ValidateIf((order: CreateOrderDto) => order.fulfillment === 'DELIVERY')
  @IsDefined()
  @ValidateNested()
  @Type(() => OrderAddressDto)
  address?: OrderAddressDto | null;

  @ApiProperty({ enum: PAYMENT_METHOD_CODES })
  @IsIn(PAYMENT_METHOD_CODES)
  paymentMethodCode!: string;

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 280 })
  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(280)
  notes?: string | null;

  @ApiProperty({ type: OrderConsentsDto })
  @ValidateNested()
  @Type(() => OrderConsentsDto)
  consents!: OrderConsentsDto;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}

export class CreatedOrderResponse {
  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  orderNumber!: number;

  @ApiProperty({ enum: ['NEW'] })
  status!: 'NEW';

  @ApiProperty()
  totalCents!: number;

  @ApiProperty()
  trackingToken!: string;

  @ApiProperty()
  trackingPath!: string;
}

export class PublicOrderOptionResponse {
  @ApiProperty()
  optionId!: string;

  @ApiProperty()
  groupName!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  priceCents!: number;
}

export class PublicOrderItemResponse {
  @ApiProperty({ nullable: true, type: String })
  productId!: string | null;

  @ApiProperty()
  productName!: string;

  @ApiProperty({ nullable: true, type: String })
  sku!: string | null;

  @ApiProperty()
  unitPriceCents!: number;

  @ApiProperty()
  quantity!: number;

  @ApiProperty({ nullable: true, type: String })
  notes!: string | null;

  @ApiProperty({ type: [PublicOrderOptionResponse] })
  options!: PublicOrderOptionResponse[];

  @ApiProperty()
  subtotalCents!: number;
}

export class PublicOrderHistoryResponse {
  @ApiProperty({ nullable: true, enum: ORDER_STATUSES })
  fromStatus!: string | null;

  @ApiProperty({ enum: ORDER_STATUSES })
  toStatus!: string;

  @ApiProperty({ enum: ['CUSTOMER', 'USER', 'SYSTEM'] })
  actorType!: string;

  @ApiProperty({ nullable: true, type: String })
  note!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class PublicOrderAddressResponse {
  @ApiProperty()
  line!: string;

  @ApiProperty()
  number!: string;

  @ApiProperty()
  district!: string;

  @ApiProperty()
  city!: string;

  @ApiProperty()
  state!: string;

  @ApiProperty()
  postalCode!: string;

  @ApiProperty({ nullable: true, type: String })
  complement!: string | null;

  @ApiProperty({ nullable: true, type: Number })
  latitude!: number | null;

  @ApiProperty({ nullable: true, type: Number })
  longitude!: number | null;
}

export class PublicOrderResponse {
  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  orderNumber!: number;

  @ApiProperty({ enum: ORDER_STATUSES })
  status!: string;

  @ApiProperty({ enum: ['DELIVERY', 'PICKUP'] })
  fulfillment!: string;

  @ApiProperty()
  paymentMethodCode!: string;

  @ApiProperty()
  paymentLabel!: string;

  @ApiProperty({ nullable: true, type: String })
  paymentInstructions!: string | null;

  @ApiProperty()
  customerName!: string;

  @ApiProperty()
  customerPhone!: string;

  @ApiProperty({ nullable: true, type: PublicOrderAddressResponse })
  address!: PublicOrderAddressResponse | null;

  @ApiProperty({ nullable: true, type: String })
  notes!: string | null;

  @ApiProperty()
  subtotalCents!: number;

  @ApiProperty()
  deliveryFeeCents!: number;

  @ApiProperty()
  totalCents!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: [PublicOrderItemResponse] })
  items!: PublicOrderItemResponse[];

  @ApiProperty({ type: [PublicOrderHistoryResponse] })
  history!: PublicOrderHistoryResponse[];
}

export class ReviewOrderDto {
  @ApiProperty({ enum: ['DELIVERY', 'PICKUP'] })
  @IsIn(['DELIVERY', 'PICKUP'])
  fulfillment!: 'DELIVERY' | 'PICKUP';

  @ApiPropertyOptional({ type: OrderAddressDto, nullable: true })
  @ValidateIf((order: ReviewOrderDto) => order.fulfillment === 'DELIVERY')
  @IsDefined()
  @ValidateNested()
  @Type(() => OrderAddressDto)
  address?: OrderAddressDto | null;

  @ApiProperty({ enum: PAYMENT_METHOD_CODES })
  @IsIn(PAYMENT_METHOD_CODES)
  paymentMethodCode!: string;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}

export class OrderReviewItemResponse {
  @ApiProperty()
  productName!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty({ nullable: true, type: String })
  notes!: string | null;

  @ApiProperty({ type: [PublicOrderOptionResponse] })
  options!: PublicOrderOptionResponse[];

  @ApiProperty()
  subtotalCents!: number;
}

export class OrderReviewResponse {
  @ApiProperty({ type: [OrderReviewItemResponse] })
  items!: OrderReviewItemResponse[];

  @ApiProperty()
  subtotalCents!: number;

  @ApiProperty()
  deliveryFeeCents!: number;

  @ApiProperty()
  totalCents!: number;

  @ApiProperty()
  paymentLabel!: string;

  @ApiProperty({ nullable: true, type: String })
  paymentInstructions!: string | null;
}

export class PublicPaymentMethodResponse {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({ nullable: true, type: String })
  instructions!: string | null;

  @ApiProperty()
  enabled!: boolean;

  @ApiProperty()
  sortOrder!: number;
}

export class PublicCheckoutResponse {
  @ApiProperty()
  pickupEnabled!: boolean;

  @ApiProperty()
  deliveryEnabled!: boolean;

  @ApiProperty({ type: [PublicPaymentMethodResponse] })
  paymentMethods!: PublicPaymentMethodResponse[];
}

function toStatusList(value: unknown): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const raw = Array.isArray(value) ? value : [value];
  const statuses = raw
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return statuses.length === 0 ? undefined : statuses;
}

function emptyQueryToUndefined(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export class ListOrdersQuery {
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

  @ApiPropertyOptional({ enum: ORDER_STATUSES, isArray: true })
  @IsOptional()
  @Transform(({ value }) => toStatusList(value))
  @IsArray()
  @IsIn(ORDER_STATUSES, { each: true })
  status?: (typeof ORDER_STATUSES)[number][];

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Transform(({ value }) => emptyQueryToUndefined(value))
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Transform(({ value }) => emptyQueryToUndefined(value))
  @IsISO8601()
  to?: string;
}

export class OrderIdParam {
  @IsUUID('4')
  id!: string;
}

export class OptionalOrderNoteDto {
  @ApiPropertyOptional({ nullable: true, maxLength: 280 })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string | null;
}

export class CancelOrderDto {
  @ApiProperty({ maxLength: 280 })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(280)
  note!: string;
}

export class AdminOrderResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  orderNumber!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty()
  totalCents!: number;

  @ApiProperty({ enum: ORDER_STATUSES })
  status!: string;

  @ApiProperty({ enum: ['DELIVERY', 'PICKUP'] })
  fulfillment!: string;

  @ApiProperty()
  customerName!: string;

  @ApiProperty({ enum: ['STOREFRONT', 'WHATSAPP', 'TEST'] })
  source!: string;

  @ApiProperty({ nullable: true, type: String })
  notes!: string | null;
}

export class AdminOrderDetailResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  orderNumber!: number;

  @ApiProperty({ enum: ORDER_STATUSES })
  status!: string;

  @ApiProperty({ enum: ['DELIVERY', 'PICKUP'] })
  fulfillment!: string;

  @ApiProperty({ enum: ['STOREFRONT', 'WHATSAPP', 'TEST'] })
  source!: string;

  @ApiProperty()
  paymentMethodCode!: string;

  @ApiProperty()
  paymentLabel!: string;

  @ApiProperty({ nullable: true, type: String })
  paymentInstructions!: string | null;

  @ApiProperty()
  customerName!: string;

  @ApiProperty()
  customerPhone!: string;

  @ApiProperty({ nullable: true, type: PublicOrderAddressResponse })
  address!: PublicOrderAddressResponse | null;

  @ApiProperty({ nullable: true, type: String })
  notes!: string | null;

  @ApiProperty()
  subtotalCents!: number;

  @ApiProperty()
  deliveryFeeCents!: number;

  @ApiProperty()
  totalCents!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: [PublicOrderItemResponse] })
  items!: PublicOrderItemResponse[];

  @ApiProperty({ type: [PublicOrderHistoryResponse] })
  history!: PublicOrderHistoryResponse[];
}

export class AdminOrderPageMeta {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class AdminOrderPageResponse {
  @ApiProperty({ type: [AdminOrderResponse] })
  data!: AdminOrderResponse[];

  @ApiProperty({ type: AdminOrderPageMeta })
  meta!: AdminOrderPageMeta;
}
