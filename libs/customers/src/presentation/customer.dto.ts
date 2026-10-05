import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
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
import { PAYMENT_METHOD_CODES } from '../domain/payment-method';

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

export class IdentifyCustomerDto {
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

export class IdentifiedCustomerResponse {
  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  phone!: string;
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

export class ListCustomersQuery extends PageQueryDto {
  @ApiPropertyOptional({ example: '11988887777' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  q?: string;
}

export class IdParam {
  @IsUUID('4')
  id!: string;
}

export class PageMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class CustomerResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class CustomerPageResponse {
  @ApiProperty({ type: [CustomerResponse] })
  data!: CustomerResponse[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}

export class CustomerAddressResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true, type: String })
  label!: string | null;

  @ApiProperty()
  line!: string;

  @ApiProperty()
  number!: string;

  @ApiProperty({ nullable: true, type: String })
  complement!: string | null;

  @ApiProperty()
  district!: string;

  @ApiProperty()
  city!: string;

  @ApiProperty()
  state!: string;

  @ApiProperty()
  postalCode!: string;

  @ApiProperty({ nullable: true, type: Number })
  latitude!: number | null;

  @ApiProperty({ nullable: true, type: Number })
  longitude!: number | null;

  @ApiProperty()
  createdAt!: Date;
}

export class CustomerDetailResponse extends CustomerResponse {
  @ApiProperty({ type: [CustomerAddressResponse] })
  addresses!: CustomerAddressResponse[];
}

export class PaymentMethodInputDto {
  @ApiProperty({ enum: PAYMENT_METHOD_CODES })
  @IsIn(PAYMENT_METHOD_CODES)
  code!: (typeof PAYMENT_METHOD_CODES)[number];

  @ApiProperty({ example: 'Dinheiro' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string | null;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

export class ReplacePaymentMethodsDto {
  @ApiProperty({ type: [PaymentMethodInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodInputDto)
  methods!: PaymentMethodInputDto[];
}

export class PaymentMethodResponse {
  @ApiProperty({ enum: PAYMENT_METHOD_CODES })
  code!: (typeof PAYMENT_METHOD_CODES)[number];

  @ApiProperty()
  label!: string;

  @ApiProperty({ nullable: true, type: String })
  instructions!: string | null;

  @ApiProperty()
  enabled!: boolean;

  @ApiProperty()
  sortOrder!: number;
}

export class PaymentMethodListResponse {
  @ApiProperty({ type: [PaymentMethodResponse] })
  methods!: PaymentMethodResponse[];
}
