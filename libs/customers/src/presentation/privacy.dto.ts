import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { CustomerDetailResponse } from './customer.dto';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class AnonymizeCustomerDto {
  @ApiProperty({ example: '11988887777' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  phone!: string;
}

export class CustomerConsentResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ['OPERATIONAL', 'MARKETING'] })
  purpose!: 'OPERATIONAL' | 'MARKETING';

  @ApiProperty()
  granted!: boolean;

  @ApiProperty()
  policyVersion!: string;

  @ApiProperty()
  ip!: string;

  @ApiProperty()
  userAgent!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class ExportedOrderItemResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty({ nullable: true, type: String })
  sku!: string | null;

  @ApiProperty()
  unitPriceCents!: number;

  @ApiProperty()
  quantity!: number;

  @ApiProperty({ nullable: true, type: String })
  notes!: string | null;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  options!: unknown[];

  @ApiProperty()
  subtotalCents!: number;
}

export class ExportedOrderResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  orderNumber!: number;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  fulfillment!: string;

  @ApiProperty()
  customerName!: string;

  @ApiProperty()
  customerPhone!: string;

  @ApiProperty({ nullable: true, type: Object })
  address!: object | null;

  @ApiProperty({ nullable: true, type: String })
  notes!: string | null;

  @ApiProperty()
  subtotalCents!: number;

  @ApiProperty()
  deliveryFeeCents!: number;

  @ApiProperty()
  totalCents!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: [ExportedOrderItemResponse] })
  items!: ExportedOrderItemResponse[];
}

export class CustomerExportResponse {
  @ApiProperty({ type: CustomerDetailResponse })
  customer!: CustomerDetailResponse;

  @ApiProperty({ type: [CustomerConsentResponse] })
  consents!: CustomerConsentResponse[];

  @ApiProperty({ type: [ExportedOrderResponse] })
  orders!: ExportedOrderResponse[];
}
