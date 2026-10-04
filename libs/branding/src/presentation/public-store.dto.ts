import { ApiProperty } from '@nestjs/swagger';
import { BrandingDto } from './branding.dto';
import { BusinessHourDto } from './business-hours.dto';

export class PublicAddressResponse {
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

export class PublicStoreResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty({ type: PublicAddressResponse })
  address!: PublicAddressResponse;

  @ApiProperty()
  minimumOrderCents!: number;

  @ApiProperty()
  isManuallyClosed!: boolean;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ type: BrandingDto })
  branding!: BrandingDto;

  @ApiProperty({ type: [BusinessHourDto] })
  hours!: BusinessHourDto[];

  @ApiProperty()
  isOpen!: boolean;
}
