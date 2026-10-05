import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class ReportPeriodQuery {
  @ApiProperty({ example: '2026-10-01' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;

  @ApiProperty({ example: '2026-10-05' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;
}

export class StatusCountResponse {
  @ApiProperty()
  status!: string;

  @ApiProperty()
  count!: number;
}

export class SourceCountResponse {
  @ApiProperty()
  source!: string;

  @ApiProperty()
  count!: number;
}

export class ReportOverviewResponse {
  @ApiProperty()
  orderCount!: number;

  @ApiProperty()
  revenueCents!: number;

  @ApiProperty()
  averageTicketCents!: number;

  @ApiProperty()
  cancelledCount!: number;

  @ApiProperty({ type: [StatusCountResponse] })
  byStatus!: StatusCountResponse[];

  @ApiProperty({ type: [SourceCountResponse] })
  bySource!: SourceCountResponse[];
}

export class ProductReportResponse {
  @ApiProperty({ nullable: true })
  productId!: string | null;

  @ApiProperty()
  productName!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  subtotalCents!: number;
}

export class CustomerReportResponse {
  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  maskedPhone!: string;

  @ApiProperty()
  orderCount!: number;
}

export class CourierReportResponse {
  @ApiProperty()
  courierId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  deliveredCount!: number;
}
