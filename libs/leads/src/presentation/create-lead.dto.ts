import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function lowerTrim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export class CreateLeadDto {
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

  @ApiProperty({ example: '11999999999' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Matches(/^[0-9+()\-\s]+$/)
  phone!: string;

  @ApiProperty({ example: 'Padaria Central' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  establishmentName!: string;
}

export class LeadCreatedResponse {
  @ApiProperty()
  id!: string;
}
