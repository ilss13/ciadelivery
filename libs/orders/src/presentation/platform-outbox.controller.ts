import { Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SuperAdminGuard } from '@ciadelivery/tenancy';
import { RequeueOutbox } from '../application/requeue-outbox';
import { OutboxEventIdParam, RequeuedOutboxResponse } from './outbox.dto';

@ApiTags('platform-outbox')
@ApiBearerAuth('bearer')
@UseGuards(SuperAdminGuard)
@Controller('api/v1/platform/outbox')
export class PlatformOutboxController {
  constructor(private readonly requeueOutbox: RequeueOutbox) {}

  @Post(':id/requeue')
  @HttpCode(200)
  @ApiOkResponse({ type: RequeuedOutboxResponse })
  requeue(@Param() params: OutboxEventIdParam): Promise<RequeuedOutboxResponse> {
    return this.requeueOutbox.execute(params.id);
  }
}
