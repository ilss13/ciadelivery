import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

function normalizeDomain(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed.length === 0 ? null : trimmed;
}

export class CustomDomainDto {
  @ApiProperty({ nullable: true, type: String, example: 'pedidos.padaria.com' })
  @Transform(({ value }) => normalizeDomain(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  customDomain!: string | null;
}

export class CustomDomainResponse {
  @ApiProperty({ nullable: true, type: String })
  customDomain!: string | null;
}
