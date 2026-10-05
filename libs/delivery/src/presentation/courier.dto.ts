import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { COURIER_STATUSES } from '../domain/courier';

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

function emptyToUndefined(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export class CreateCourierDto {
  @ApiProperty({ example: 'Lia Costa' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: '11977776666' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  phone!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID('4')
  userId?: string;

  @ApiPropertyOptional({ example: 'lia@padaria.example' })
  @ValidateIf((dto: CreateCourierDto) => dto.userId === undefined)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: CreateCourierDto) => dto.userId === undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password?: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(40)
  vehicleType?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(280)
  notes?: string | null;

  @ApiPropertyOptional({ enum: COURIER_STATUSES, default: 'AVAILABLE' })
  @IsOptional()
  @IsIn(COURIER_STATUSES)
  status?: (typeof COURIER_STATUSES)[number];
}

export class UpdateCourierDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional({ enum: COURIER_STATUSES })
  @IsOptional()
  @IsIn(COURIER_STATUSES)
  status?: (typeof COURIER_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ nullable: true, type: String })
  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(40)
  vehicleType?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(280)
  notes?: string | null;
}

export class ListCouriersQuery {
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

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) {
      return true;
    }
    if (value === 'false' || value === false) {
      return false;
    }
    return value;
  })
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ enum: COURIER_STATUSES })
  @IsOptional()
  @IsIn(COURIER_STATUSES)
  status?: (typeof COURIER_STATUSES)[number];
}

export class CourierIdParam {
  @IsUUID('4')
  id!: string;
}

export class CourierResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: COURIER_STATUSES })
  status!: string;

  @ApiProperty()
  active!: boolean;

  @ApiProperty({ nullable: true, type: String })
  vehicleType!: string | null;

  @ApiProperty({ nullable: true, type: String })
  notes!: string | null;
}

export class CreatedCourierResponse extends CourierResponse {
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Returned once when a login is created. It is not stored in clear text.',
  })
  initialPassword!: string | null;
}

export class CourierPageMeta {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class CourierPageResponse {
  @ApiProperty({ type: [CourierResponse] })
  data!: CourierResponse[];

  @ApiProperty({ type: CourierPageMeta })
  meta!: CourierPageMeta;
}
