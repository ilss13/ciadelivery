import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class BusinessHourDto {
  @ApiProperty({ example: 0, minimum: 0, maximum: 6 })
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @ApiProperty({ example: '18:00:00' })
  @IsString()
  @MaxLength(8)
  opensAt!: string;

  @ApiProperty({ example: '23:00:00' })
  @IsString()
  @MaxLength(8)
  closesAt!: string;

  @ApiProperty()
  @IsBoolean()
  closed!: boolean;
}

export class ReplaceBusinessHoursDto {
  @ApiProperty({ type: [BusinessHourDto] })
  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => BusinessHourDto)
  hours!: BusinessHourDto[];
}

export class BusinessHoursResponse {
  @ApiProperty({ type: [BusinessHourDto] })
  hours!: BusinessHourDto[];
}
