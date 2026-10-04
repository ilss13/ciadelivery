import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

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

export class BrandingDto {
  @ApiProperty({ example: 'Pizzaria do Ze' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  displayName!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  faviconUrl!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bannerUrl!: string | null;

  @ApiProperty({ example: '#C0392B' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(7)
  primaryColor!: string;

  @ApiProperty({ example: '#922B21' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(7)
  secondaryColor!: string;

  @ApiProperty({ example: '#F5B7B1' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(7)
  accentColor!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(80)
  fontFamily!: string | null;

  @ApiProperty({ example: 'Pizzaria do Ze' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(180)
  seoTitle!: string;

  @ApiProperty({ example: '' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(320)
  seoDescription!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  instagramUrl!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  facebookUrl!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  websiteUrl!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  contactEmail!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsappPhone!: string | null;
}
