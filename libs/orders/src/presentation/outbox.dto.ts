import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class OutboxEventIdParam {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id!: string;
}

export class RequeuedOutboxResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['PENDING'] })
  status!: 'PENDING';
}
