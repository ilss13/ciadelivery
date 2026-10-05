import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class DeliveryZoneInputDto {
  @ApiProperty({ example: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999.99)
  fromKm!: number;

  @ApiProperty({ example: 3 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999.99)
  toKm!: number;

  @ApiProperty({ example: 500 })
  @IsInt()
  @Min(0)
  feeCents!: number;
}

export class UpdateDeliveryConfigDto {
  @ApiProperty()
  @IsBoolean()
  deliveryEnabled!: boolean;

  @ApiProperty()
  @IsBoolean()
  pickupEnabled!: boolean;

  @ApiProperty({ example: 8 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999.99)
  maxRadiusKm!: number;

  @ApiProperty({ enum: ['FLAT', 'ZONE'] })
  @IsIn(['FLAT', 'ZONE'])
  feeMode!: 'FLAT' | 'ZONE';

  @ApiProperty({ example: 500 })
  @IsInt()
  @Min(0)
  flatFeeCents!: number;

  @ApiProperty({ example: 40 })
  @IsInt()
  @Min(1)
  estimatedMinutes!: number;

  @ApiPropertyOptional({
    type: [DeliveryZoneInputDto],
    description:
      'When present, replaces every zone in the same request. Overlapping bands are rejected.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => DeliveryZoneInputDto)
  zones?: DeliveryZoneInputDto[];
}

export class ReplaceDeliveryZonesDto {
  @ApiProperty({
    type: [DeliveryZoneInputDto],
    description:
      'Replaces the full zone list. Single-zone changes use POST, PATCH and DELETE.',
  })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => DeliveryZoneInputDto)
  zones!: DeliveryZoneInputDto[];
}

export class PatchDeliveryZoneDto {
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999.99)
  fromKm?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999.99)
  toKm?: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsInt()
  @Min(0)
  feeCents?: number;
}

export class DeliveryZoneIdParam {
  @ApiProperty()
  @IsUUID()
  id!: string;
}

export class DeliveryConfigResponse {
  @ApiProperty()
  deliveryEnabled!: boolean;

  @ApiProperty()
  pickupEnabled!: boolean;

  @ApiProperty()
  maxRadiusKm!: number;

  @ApiProperty({ enum: ['FLAT', 'ZONE'] })
  feeMode!: 'FLAT' | 'ZONE';

  @ApiProperty()
  flatFeeCents!: number;

  @ApiProperty()
  estimatedMinutes!: number;

  @ApiProperty({ nullable: true, type: Number })
  originLatitude!: number | null;

  @ApiProperty({ nullable: true, type: Number })
  originLongitude!: number | null;
}

export class DeliveryZoneResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  fromKm!: number;

  @ApiProperty()
  toKm!: number;

  @ApiProperty()
  feeCents!: number;

  @ApiProperty()
  sortOrder!: number;
}

export class DeliveryZoneListResponse {
  @ApiProperty({ type: [DeliveryZoneResponse] })
  zones!: DeliveryZoneResponse[];
}

export class DeliveryAddressDto {
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

export class PublicDeliveryQuoteDto {
  @ApiPropertyOptional({ enum: ['DELIVERY', 'PICKUP'] })
  @IsOptional()
  @IsIn(['DELIVERY', 'PICKUP'])
  fulfillment?: 'DELIVERY' | 'PICKUP';

  @ApiPropertyOptional({ type: DeliveryAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  address?: DeliveryAddressDto;
}

export class PublicDeliveryQuoteResponse {
  @ApiProperty()
  accepted!: boolean;

  @ApiProperty({ enum: ['DELIVERY', 'PICKUP'] })
  fulfillment!: 'DELIVERY' | 'PICKUP';

  @ApiProperty({ nullable: true, type: Number, example: 2.4 })
  distanceKm!: number | null;

  @ApiProperty({ example: 500 })
  feeCents!: number;

  @ApiProperty({ nullable: true, type: Number, example: 40 })
  estimatedMinutes!: number | null;

  @ApiProperty({ nullable: true, type: String, example: null })
  reason!: string | null;
}

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function emptyToNull(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
