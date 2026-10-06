import { SuperAdminGuard } from '@ciadelivery/tenancy';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ReadPilotStatus } from '../application/read-pilot-status';
import { PilotStatusResponse } from './onboarding.dto';

@ApiTags('platform-pilot')
@ApiBearerAuth('bearer')
@UseGuards(SuperAdminGuard)
@Controller('api/v1/platform/pilot-status')
export class PlatformPilotStatusController {
  constructor(private readonly read: ReadPilotStatus) {}

  @Get()
  @ApiOkResponse({ type: PilotStatusResponse })
  get(): Promise<PilotStatusResponse> {
    return this.read.execute();
  }
}
