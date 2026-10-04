import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class StoreAddressDto {
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

export class UpdateStoreDto {
  @ApiProperty({ example: 'Padaria Central' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: '11999999999' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Matches(/^[0-9+()\-\s]+$/)
  phone!: string;

  @ApiProperty({ type: StoreAddressDto })
  @ValidateNested()
  @Type(() => StoreAddressDto)
  address!: StoreAddressDto;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  @Max(4294967295)
  minimumOrderCents!: number;

  @ApiProperty()
  @IsBoolean()
  isManuallyClosed!: boolean;
}

export class StoreSettingsResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty({ type: StoreAddressDto })
  address!: StoreAddressDto;

  @ApiProperty()
  minimumOrderCents!: number;

  @ApiProperty()
  isManuallyClosed!: boolean;

  @ApiProperty({ example: 'America/Sao_Paulo' })
  timezone!: string;
}
