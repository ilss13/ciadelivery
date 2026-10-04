import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
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
  ValidateNested,
} from 'class-validator';
import {
  PERMISSIONS,
  TENANT_ROLES,
  USER_STATUSES,
} from '@ciadelivery/users';

function lowerTrim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class LoginDto {
  @ApiProperty({ example: 'ana@padaria.example' })
  @Transform(({ value }) => lowerTrim(value))
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'senha-forte-1' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'ana@padaria.example' })
  @Transform(({ value }) => lowerTrim(value))
  @IsEmail()
  @MaxLength(255)
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  token!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}

export class AccessTokenResponse {
  @ApiProperty()
  accessToken!: string;
}

export class PermissionOverrideDto {
  @ApiProperty({ enum: PERMISSIONS })
  @IsIn(PERMISSIONS)
  permission!: (typeof PERMISSIONS)[number];

  @ApiProperty()
  @IsBoolean()
  granted!: boolean;
}

export class CreateUserDto {
  @ApiProperty({ example: 'Ana Souza' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 'ana@padaria.example' })
  @Transform(({ value }) => lowerTrim(value))
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;

  @ApiProperty({ enum: TENANT_ROLES })
  @IsIn(TENANT_ROLES)
  role!: (typeof TENANT_ROLES)[number];

  @ApiPropertyOptional({ type: [PermissionOverrideDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionOverrideDto)
  permissionOverrides?: PermissionOverrideDto[];
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ enum: TENANT_ROLES })
  @IsOptional()
  @IsIn(TENANT_ROLES)
  role?: (typeof TENANT_ROLES)[number];

  @ApiPropertyOptional({ enum: USER_STATUSES })
  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: (typeof USER_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password?: string;

  @ApiPropertyOptional({ type: [PermissionOverrideDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionOverrideDto)
  permissionOverrides?: PermissionOverrideDto[];
}

export class CreateOwnerDto {
  @ApiProperty({ example: 'Ana Souza' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 'ana@padaria.example' })
  @Transform(({ value }) => lowerTrim(value))
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}

export class UserIdParam {
  @IsUUID('4')
  id!: string;
}

export class ListUsersQuery {
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

export class UserResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true, type: String })
  tenantId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  storeId!: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ type: [String] })
  permissions!: string[];

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
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

export class UserListResponse {
  @ApiProperty({ type: [UserResponse] })
  data!: UserResponse[];

  @ApiProperty({ type: PageMetaResponse })
  meta!: PageMetaResponse;
}
