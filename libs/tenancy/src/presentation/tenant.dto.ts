import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TENANT_STATUSES, TenantStatus } from '../domain/tenant';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function lowerTrim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export class AddressDto {
  @ApiProperty({ example: 'Rua das Flores' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  line!: string;

  @ApiProperty({ example: '100' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  number!: string;

  @ApiProperty({ example: 'Centro' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  district!: string;

  @ApiProperty({ example: 'Sao Paulo' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  city!: string;

  @ApiProperty({ example: 'SP' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  state!: string;

  @ApiProperty({ example: '01000-000' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  postalCode!: string;
}

export class CreateTenantDto {
  @ApiProperty({ example: 'Padaria Central' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 'padaria-central' })
  @Transform(({ value }) => lowerTrim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(63)
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;

  @ApiProperty({ example: '11999999999' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Matches(/^[0-9+()\-\s]+$/)
  phone!: string;

  @ApiProperty({ type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;
}

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'Padaria Central' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ enum: TENANT_STATUSES })
  @IsOptional()
  @IsIn(TENANT_STATUSES)
  status?: TenantStatus;

  @ApiPropertyOptional({ example: 'STANDARD' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9_-]+$/)
  planCode?: string;

  @ApiPropertyOptional({ nullable: true, example: 'pedidos.padaria.com' })
  @IsOptional()
  @Transform(({ value }) => (value === null ? null : lowerTrim(value)))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  customDomain?: string | null;
}

export class TenantIdParam {
  @IsUUID('4')
  id!: string;
}

export class ListTenantsQuery {
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

export class StoreAddressResponse {
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
}

export class StoreResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty({ type: StoreAddressResponse })
  address!: StoreAddressResponse;

  @ApiProperty({ nullable: true, type: Number })
  latitude!: number | null;

  @ApiProperty({ nullable: true, type: Number })
  longitude!: number | null;

  @ApiProperty()
  minimumOrderCents!: number;

  @ApiProperty()
  isManuallyClosed!: boolean;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class TenantResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ enum: TENANT_STATUSES })
  status!: string;

  @ApiProperty()
  planCode!: string;

  @ApiProperty({ nullable: true, type: String })
  customDomain!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ type: StoreResponse })
  store!: StoreResponse;
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

export class TenantListResponse {
  @ApiProperty({ type: [TenantResponse] })
  data!: TenantResponse[];

  @ApiProperty({ type: PageMetaResponse })
  meta!: PageMetaResponse;
}
