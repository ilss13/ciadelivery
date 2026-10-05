import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListNotificationsQuery {
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

export class NotificationIdParam {
  @IsUUID('4')
  id!: string;
}

export class NotificationResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'order.created' })
  type!: string;

  @ApiProperty({ example: 'Novo pedido #1' })
  title!: string;

  @ApiProperty({ example: 'Novo pedido #1' })
  body!: string;

  @ApiProperty({ nullable: true, type: String })
  orderId!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  readAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class NotificationPageMeta {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class NotificationPageResponse {
  @ApiProperty({ type: [NotificationResponse] })
  data!: NotificationResponse[];

  @ApiProperty({ type: NotificationPageMeta })
  meta!: NotificationPageMeta;
}
