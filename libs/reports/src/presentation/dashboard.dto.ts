import { ApiProperty } from '@nestjs/swagger';

export class DashboardResponse {
  @ApiProperty()
  newCount!: number;

  @ApiProperty()
  inPreparationCount!: number;

  @ApiProperty()
  readyCount!: number;

  @ApiProperty()
  outForDeliveryCount!: number;

  @ApiProperty()
  deliveredTodayCount!: number;

  @ApiProperty()
  revenueCents!: number;

  @ApiProperty()
  storeOpen!: boolean;

  @ApiProperty()
  whatsappConnected!: boolean;
}
