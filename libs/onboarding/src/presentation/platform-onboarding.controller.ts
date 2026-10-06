import { TenantContextInterceptor } from '@ciadelivery/tenancy/guards';
import { SuperAdminGuard } from '@ciadelivery/tenancy';
import {
  Controller,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ReadOnboarding } from '../application/onboarding';
import {
  OnboardingChecklistResponse,
  TenantOnboardingParam,
} from './onboarding.dto';

@ApiTags('platform-onboarding')
@ApiBearerAuth('bearer')
@UseGuards(SuperAdminGuard)
@UseInterceptors(TenantContextInterceptor)
@Controller('api/v1/platform/tenants/:id/onboarding')
export class PlatformOnboardingController {
  constructor(private readonly read: ReadOnboarding) {}

  @Get()
  @ApiOkResponse({ type: OnboardingChecklistResponse })
  get(
    @Param() params: TenantOnboardingParam,
  ): Promise<OnboardingChecklistResponse> {
    return this.read.forTenant(params.id);
  }
}
