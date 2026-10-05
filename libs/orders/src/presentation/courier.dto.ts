import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ORDER_STATUSES } from '../domain/order-status';

export class AssignCourierDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  courierId!: string;
}

export class CourierHistoryQuery {
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

export class CourierAddressResponse {
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

  @ApiProperty({ nullable: true, type: String })
  complement!: string | null;
}

export class CourierOrderResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  orderNumber!: number;

  @ApiProperty({ enum: ORDER_STATUSES })
  status!: string;

  @ApiProperty()
  totalCents!: number;

  @ApiProperty({ nullable: true, type: CourierAddressResponse })
  address!: CourierAddressResponse | null;
}

export class CourierOrderDetailResponse extends CourierOrderResponse {
  @ApiProperty()
  customerPhone!: string;
}

export class CourierOrderListResponse {
  @ApiProperty({ type: [CourierOrderResponse] })
  data!: CourierOrderResponse[];
}

export class CourierHistoryItemResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  orderNumber!: number;

  @ApiProperty()
  totalCents!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  deliveredAt!: Date;

  @ApiProperty({ nullable: true, type: CourierAddressResponse })
  address!: CourierAddressResponse | null;
}

export class CourierHistoryMeta {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class CourierHistoryResponse {
  @ApiProperty({ type: [CourierHistoryItemResponse] })
  data!: CourierHistoryItemResponse[];

  @ApiProperty({ type: CourierHistoryMeta })
  meta!: CourierHistoryMeta;
}
